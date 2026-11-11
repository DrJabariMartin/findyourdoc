import { test } from "node:test";
import assert from "node:assert/strict";
import { medianResponseHours, practiceMayOpen, responseLabel, MIN_APPLICATIONS } from "../src/lib/hiring";
import { guessProfession, messages, pickEarlierSlot } from "../src/lib/automation/rules";
import { lastVerified } from "../src/lib/reviews";

const HOUR = 3_600_000;
const now = new Date("2030-06-01T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * HOUR);

test("response time is the median, and unanswered applications count against the practice", () => {
  assert.equal(medianResponseHours([{ createdAt: ago(10), firstResponseAt: ago(9) }], now), null, `fewer than ${MIN_APPLICATIONS} is too few`);
  const answered = [2, 4, 6].map((h) => ({ createdAt: ago(100), firstResponseAt: new Date(ago(100).getTime() + h * HOUR) }));
  assert.equal(medianResponseHours(answered, now), 4);
  // Two ignored for 200 hours push the median past a week.
  const ignored = [...answered, { createdAt: ago(200), firstResponseAt: null }, { createdAt: ago(200), firstResponseAt: null }];
  assert.equal(medianResponseHours(ignored, now), 6);
  const mostlyIgnored = [answered[0], ...Array(3).fill({ createdAt: ago(300), firstResponseAt: null })];
  assert.ok(medianResponseHours(mostlyIgnored, now)! > 168);
  // Applications older than the window don't count.
  assert.equal(medianResponseHours([0, 1, 2].map(() => ({ createdAt: ago(24 * 200), firstResponseAt: null })), now), null);
});

test("response labels", () => {
  assert.match(responseLabel(null), /not enough/);
  assert.equal(responseLabel(5), "Usually responds within a day");
  assert.equal(responseLabel(48), "Usually responds within 3 days");
  assert.equal(responseLabel(100), "Usually responds within a week");
  assert.match(responseLabel(500), /slow/);
});

test("a practice opens documents only with consent, and only verified ones", () => {
  assert.equal(practiceMayOpen(null, "VERIFIED"), false);
  assert.equal(practiceMayOpen({ shareDocs: false }, "VERIFIED"), false);
  assert.equal(practiceMayOpen({ shareDocs: true }, "PENDING"), false);
  assert.equal(practiceMayOpen({ shareDocs: true }, "VERIFIED"), true);
});

test("profession guess from the NPI registry prefers the specific role", () => {
  assert.equal(guessProfession("M.D.", "Orthopaedic Surgery"), "PHYSICIAN");
  assert.equal(guessProfession("CRNA", "Nurse Anesthetist, Certified Registered"), "CRNA");
  assert.equal(guessProfession("FNP", "Nurse Practitioner, Family"), "NP");
  assert.equal(guessProfession("PA-C", "Physician Assistant, Medical"), "PA");
  assert.equal(guessProfession("DPT", "Physical Therapist"), "PT");
  assert.equal(guessProfession("RN", "Registered Nurse"), "NURSE");
  assert.equal(guessProfession(null, null), null);
});

test("earlier-time alerts offer only earlier slots at least 2 hours away", () => {
  const booked = new Date(now.getTime() + 72 * HOUR);
  const s = (h: number) => ({ id: `s${h}`, startsAt: new Date(now.getTime() + h * HOUR) });
  assert.equal(pickEarlierSlot([s(1), s(80)], booked, now), null);
  assert.equal(pickEarlierSlot([s(48), s(3), s(1)], booked, now)?.id, "s3");
  assert.equal(pickEarlierSlot([], booked, now), null);
});

test("patient and Lounge emails carry no health or post details", () => {
  const e = messages.earlierTime("Mon, Jun 3, 9:00 AM", "https://x/appointments/tok");
  assert.match(e.body, /https:\/\/x\/appointments\/tok/);
  assert.doesNotMatch(e.body + e.subject, /reason|insurance|diagnos/i);
  const r = messages.loungeReply("https://x", "clinical");
  assert.match(r.body, /lounge\?room=clinical/);
});

test("last verified is the newest of admin verification and clean re-checks", () => {
  assert.equal(lastVerified(null, []), null);
  assert.deepEqual(lastVerified(ago(500), [{ createdAt: ago(10) }]), ago(10));
  assert.deepEqual(lastVerified(ago(5), [{ createdAt: ago(10) }]), ago(5));
});
