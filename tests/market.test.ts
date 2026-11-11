import { test } from "node:test";
import assert from "node:assert/strict";
import { launchStates, licensedStates, servesState, videoStates, visitState } from "../src/lib/market";
import { bookingFeeCents } from "../src/lib/fees";
import { visitFacts } from "../src/lib/visit";

const DMV = ["MD", "DC", "VA"];
const now = new Date("2026-11-10T12:00:00Z");
const md = { status: "VERIFIED", licenseState: "MD", officeState: "MD", licenses: [] as { state: string; expiresAt: Date | null }[] };

test("launch market defaults to DC, Maryland and Virginia and ignores junk", () => {
  assert.deepEqual(launchStates({}), DMV);
  assert.deepEqual(launchStates({ LAUNCH_STATES: " md, va ,xx1,va" }), ["MD", "VA"]);
  assert.deepEqual(launchStates({ LAUNCH_STATES: "" }), DMV);
});

test("only verified, unexpired licenses count", () => {
  assert.deepEqual(licensedStates({ ...md, status: "PENDING" }, now), []);
  const c = { ...md, licenses: [{ state: "DC", expiresAt: null }, { state: "VA", expiresAt: new Date("2026-01-01") }] };
  assert.deepEqual(licensedStates(c, now), ["DC", "MD"]);
  assert.deepEqual(videoStates({ ...c, licenses: [...c.licenses, { state: "GA", expiresAt: null }] }, DMV, now), ["DC", "MD"]);
});

test("video visits follow the patient's location", () => {
  assert.deepEqual(visitState("VIDEO", md, "MD", DMV, now), { state: "MD" });
  assert.ok("error" in visitState("VIDEO", md, undefined, DMV, now), "state is required");
  assert.match((visitState("VIDEO", md, "VA", DMV, now) as { error: string }).error, /isn't licensed in VA/);
  const everywhere = { ...md, licenses: [{ state: "GA", expiresAt: null }] };
  assert.match((visitState("VIDEO", everywhere, "GA", DMV, now) as { error: string }).error, /aren't open in GA/);
});

test("in-person visits need a licensed office inside the launch market", () => {
  assert.deepEqual(visitState("IN_PERSON", md, "VA", DMV, now), { state: "MD" }, "patient state is ignored in person");
  assert.ok("error" in visitState("IN_PERSON", { ...md, officeState: "VA" }, undefined, DMV, now));
  assert.ok("error" in visitState("IN_PERSON", { ...md, licenseState: "GA", officeState: "GA" }, undefined, DMV, now));
});

test("search shows a clinician only where they can see the patient", () => {
  assert.ok(servesState(md, undefined, DMV, false, now));
  assert.ok(servesState(md, "MD", DMV, false, now));
  assert.ok(!servesState(md, "DC", DMV, false, now), "no DC office and no video");
  assert.ok(!servesState(md, "DC", DMV, true, now), "video, but no DC license");
  assert.ok(servesState({ ...md, licenses: [{ state: "DC", expiresAt: null }] }, "DC", DMV, true, now));
  assert.ok(!servesState({ ...md, licenseState: "GA", officeState: "GA" }, undefined, DMV, true, now), "outside the market");
  assert.ok(!servesState(md, "GA", DMV, true, now));
});

test("a fee waiver makes every booking free, like government plans", () => {
  const visit = { status: "COMPLETED", newPatient: true, source: "FINDYOURDOC" };
  assert.equal(bookingFeeCents(visit), 4000);
  assert.equal(bookingFeeCents({ ...visit, feeWaived: true }), 0);
  assert.equal(bookingFeeCents({ ...visit, feeWaived: false }), 4000);
});

test("video visit emails say video, carry no address and no health details", () => {
  const clinician = { officeName: "Sample Ortho", officeAddress: "100 Example Way", officeCity: "Columbia", officeState: "MD", user: { name: "Dr. Sample" } };
  const v = visitFacts({ accessToken: "t", patientState: "DC", slot: { startsAt: now, mode: "VIDEO", clinician } });
  assert.match(v.office, /Video visit/);
  assert.match(v.office, /be in DC/);
  assert.doesNotMatch(v.office, /100 Example Way/);
  const p = visitFacts({ accessToken: "t", slot: { startsAt: now, mode: "IN_PERSON", clinician } });
  assert.match(p.office, /100 Example Way/);
});

test("bookings through the practice's own link are never charged", async () => {
  const { bookingSource, isBookingCode, newBookingCode } = await import("../src/lib/booking-link");
  const code = newBookingCode();
  assert.ok(isBookingCode(code));
  assert.ok(!isBookingCode("../x"));
  assert.equal(bookingSource(code, code), "PRACTICE_SITE");
  assert.equal(bookingSource(code, "wrong-code-123"), "FINDYOURDOC");
  assert.equal(bookingSource(null, code), "FINDYOURDOC", "no link made yet");
  assert.equal(bookingSource(code, undefined), "FINDYOURDOC");
  const visit = { status: "COMPLETED", newPatient: true };
  assert.equal(bookingFeeCents({ ...visit, source: bookingSource(code, code) }), 0);
  assert.equal(bookingFeeCents({ ...visit, source: bookingSource(code, undefined) }), 4000);
});
