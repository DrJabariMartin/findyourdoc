import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  authorizeUrl, calendarEnabled, clashes, decryptToken, encryptToken, exchangeCode, fetchBusy,
  parseGoogleBusy, parseMicrosoftBusy, planSlotChanges, readState, signState,
} from "../src/lib/calendar";
import { reminderText, smsMode, smsTransport, toE164 } from "../src/lib/sms";
import { canInvite, seatLimit } from "../src/lib/team";

const env = {
  GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret",
  MICROSOFT_CLIENT_ID: "mid", MICROSOFT_CLIENT_SECRET: "msecret",
  CALENDAR_TOKEN_KEY: randomBytes(32).toString("base64"),
  SESSION_SECRET: "a-test-session-secret-of-some-length",
};
const at = (iso: string) => new Date(iso);

test("calendar sync stays off until keys are set", () => {
  assert.equal(calendarEnabled("GOOGLE", {}), false);
  assert.equal(calendarEnabled("GOOGLE", { ...env, CALENDAR_TOKEN_KEY: "short" }), false);
  assert.equal(calendarEnabled("GOOGLE", env), true);
  assert.equal(calendarEnabled("MICROSOFT", env), true);
});

test("sign-in links ask only for busy-time access", () => {
  const g = new URL(authorizeUrl("GOOGLE", "https://app.test/", "st", env));
  assert.equal(g.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.freebusy");
  assert.equal(g.searchParams.get("redirect_uri"), "https://app.test/api/calendar/google/callback");
  assert.equal(g.searchParams.get("access_type"), "offline");
  const m = new URL(authorizeUrl("MICROSOFT", "https://app.test", "st", env));
  assert.match(m.searchParams.get("scope")!, /Calendars\.ReadBasic/);
  assert.doesNotMatch(m.searchParams.get("scope")!, /ReadWrite|Calendars\.Read( |$)/);
});

test("OAuth state is signed, bound to the clinician and expires", () => {
  const s = signState("clin1", 1_000_000, env);
  assert.equal(readState(s, 1_000_000 + 60_000, env), "clin1");
  assert.equal(readState(s, 1_000_000 + 16 * 60_000, env), null);
  const [b] = s.split(".");
  const forged = `${Buffer.from(Buffer.from(b, "base64url").toString().replace("clin1", "clin2")).toString("base64url")}.${s.split(".")[1]}`;
  assert.equal(readState(forged, 1_000_000, env), null);
  assert.equal(readState("garbage", 1_000_000, env), null);
});

test("refresh tokens are encrypted at rest", () => {
  const sealed = encryptToken("1//refresh-token", env);
  assert.doesNotMatch(sealed, /refresh-token/);
  assert.equal(decryptToken(sealed, env), "1//refresh-token");
  assert.throws(() => decryptToken(sealed, { ...env, CALENDAR_TOKEN_KEY: randomBytes(32).toString("base64") }));
});

test("busy times parse from Google and Microsoft; free time doesn't block", () => {
  const g = parseGoogleBusy({ calendars: { primary: { busy: [{ start: "2030-01-01T14:00:00Z", end: "2030-01-01T15:00:00Z" }] } } });
  assert.deepEqual(g, [{ start: at("2030-01-01T14:00:00Z"), end: at("2030-01-01T15:00:00Z") }]);
  const m = parseMicrosoftBusy({ value: [
    { showAs: "busy", start: { dateTime: "2030-01-01T14:00:00.0000000" }, end: { dateTime: "2030-01-01T15:00:00.0000000" } },
    { showAs: "free", start: { dateTime: "2030-01-01T16:00:00" }, end: { dateTime: "2030-01-01T17:00:00" } },
    { showAs: "oof", start: { dateTime: "2030-01-02T00:00:00" }, end: { dateTime: "2030-01-03T00:00:00" } },
  ] });
  assert.equal(m.length, 2);
  assert.deepEqual(m[0].start, at("2030-01-01T14:00:00Z"));
  assert.deepEqual(parseGoogleBusy(null), []);
});

test("only open slots that clash are hidden; booked visits are never touched", () => {
  const busy = [{ start: at("2030-01-01T14:00:00Z"), end: at("2030-01-01T15:00:00Z") }];
  const slot = (id: string, iso: string, status: string) => ({ id, startsAt: at(iso), minutes: 30, status });
  assert.equal(clashes(slot("a", "2030-01-01T13:30:00Z", "OPEN"), busy), false, "ends exactly when busy starts");
  assert.equal(clashes(slot("a", "2030-01-01T13:45:00Z", "OPEN"), busy), true);
  const plan = planSlotChanges([
    slot("open-clash", "2030-01-01T14:00:00Z", "OPEN"),
    slot("booked-clash", "2030-01-01T14:30:00Z", "BOOKED"),
    slot("busy-clear", "2030-01-01T16:00:00Z", "BUSY"),
    slot("busy-still", "2030-01-01T14:15:00Z", "BUSY"),
    slot("open-clear", "2030-01-01T09:00:00Z", "OPEN"),
  ], busy);
  assert.deepEqual(plan, { hide: ["open-clash"], reopen: ["busy-clear"] });
});

test("provider calls use the right endpoints and fail loudly", async () => {
  const calls: string[] = [];
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (String(url).includes("token")) return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt" }));
    if (String(url).includes("freeBusy")) return new Response(JSON.stringify({ calendars: { primary: { busy: [] } } }));
    return new Response("{}", { status: 500 });
  }) as typeof fetch;
  assert.equal(await exchangeCode("GOOGLE", "code", "https://app.test", env, fake), "rt");
  assert.deepEqual(await fetchBusy("GOOGLE", "at", at("2030-01-01T00:00:00Z"), at("2030-01-02T00:00:00Z"), fake), []);
  await assert.rejects(fetchBusy("MICROSOFT", "at", at("2030-01-01T00:00:00Z"), at("2030-01-02T00:00:00Z"), fake), /HTTP 500/);
  assert.ok(calls.some((c) => c.startsWith("POST https://oauth2.googleapis.com/token")));
});

test("texts are off by default and carry no health details", async () => {
  assert.equal(smsMode({}), "off");
  assert.equal(smsMode({ SMS_TRANSPORT: "aws" }), "off", "aws needs an origination number");
  assert.equal(smsMode({ SMS_TRANSPORT: "aws", SMS_ORIGINATION_IDENTITY: "+12025550100" }), "aws");
  assert.equal(await smsTransport({}).send({ to: "+1", body: "x" }), false);
  const body = reminderText("Tue, Jan 1, 9:00 AM", "https://app.test/appointments/tok");
  assert.match(body, /STOP/);
  assert.ok(body.length <= 160, `one SMS segment, got ${body.length}`);
  const sent: unknown[] = [];
  const t = smsTransport({ SMS_TRANSPORT: "aws", SMS_ORIGINATION_IDENTITY: "+12025550100", SMS_OPT_OUT_LIST: "default" }, { send: async (c) => { sent.push(c); } });
  assert.equal(await t.send({ to: "+12025550123", body }), true);
  assert.equal(sent.length, 1);
});

test("phone numbers normalise to US E.164 or are skipped", () => {
  assert.equal(toE164("(301) 555-0123"), "+13015550123");
  assert.equal(toE164("1-301-555-0123"), "+13015550123");
  assert.equal(toE164("555-0123"), null);
  assert.equal(toE164("+44 20 7946 0958"), null);
});

test("team seats follow the plan", () => {
  assert.equal(seatLimit("SOLO"), 1);
  assert.equal(canInvite("SOLO", 1, 0), false);
  assert.equal(canInvite("GROUP", 1, 0), true);
  assert.equal(canInvite("GROUP", 20, 5), false);
});
