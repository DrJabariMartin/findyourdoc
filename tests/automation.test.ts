import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentReminderDue,
  clinicianFitsJob,
  compareWithRegistry,
  DAY_MS,
  expiryReminderBand,
  HOUR_MS,
  messages,
  namesAgree,
  recheckDue,
  visitNeedsRecording,
} from "../src/lib/automation/rules";

const profile = { name: "Jane Q. Smith", profession: "PHYSICIAN", licenseState: "GA", licenseNumber: "ME 012345", npi: "1234567893" };
const registry = { npi: "1234567893", name: "JANE SMITH", credential: "M.D.", taxonomy: "Orthopaedic Surgery", state: "GA", licenseNumber: "12345" };

test("registry check passes when name, profession, state and license agree", () => {
  assert.deepEqual(compareWithRegistry(profile, registry), { result: "MATCH", issues: [] });
});

test("registry check flags each difference for the admin", () => {
  const r = compareWithRegistry({ ...profile, name: "John Doe", licenseState: "FL", licenseNumber: "99999" }, registry);
  assert.equal(r.result, "MISMATCH");
  assert.equal(r.issues.length, 3);
  const prof = compareWithRegistry({ ...profile, profession: "PT" }, registry);
  assert.equal(prof.result, "MISMATCH");
  assert.match(prof.issues[0], /Profession/);
});

test("missing or unknown NPI never passes", () => {
  assert.equal(compareWithRegistry({ ...profile, npi: null }, null).result, "NO_NPI");
  assert.equal(compareWithRegistry(profile, null).result, "NOT_FOUND");
});

test("name matching tolerates titles and middle names", () => {
  assert.ok(namesAgree("Dr. Jane Q. Smith", "JANE SMITH"));
  assert.ok(!namesAgree("Jane Smith", "JANE SMYTHE"));
  assert.ok(!namesAgree("Mark Smith", "JANE SMITH"));
});

test("professions match their usual registry credentials", () => {
  const np = compareWithRegistry({ ...profile, profession: "NP" }, { ...registry, credential: "APRN, FNP-C", taxonomy: "Nurse Practitioner, Family" });
  assert.equal(np.result, "MATCH");
  const pt = compareWithRegistry({ ...profile, profession: "PT" }, { ...registry, credential: "DPT", taxonomy: "Physical Therapist" });
  assert.equal(pt.result, "MATCH");
});

test("job alerts go only to verified clinicians with the right profession and license state", () => {
  const job = { profession: "PHYSICIAN", state: "GA", status: "OPEN" };
  assert.ok(clinicianFitsJob(job, { profession: "PHYSICIAN", licenseState: "GA", status: "VERIFIED" }));
  assert.ok(!clinicianFitsJob(job, { profession: "PHYSICIAN", licenseState: "FL", status: "VERIFIED" }));
  assert.ok(!clinicianFitsJob(job, { profession: "NP", licenseState: "GA", status: "VERIFIED" }));
  assert.ok(!clinicianFitsJob(job, { profession: "PHYSICIAN", licenseState: "GA", status: "PENDING" }));
  assert.ok(!clinicianFitsJob({ ...job, status: "FILLED" }, { profession: "PHYSICIAN", licenseState: "GA", status: "VERIFIED" }));
});

test("credential reminders at 60, 30 and 7 days, then expired", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const inDays = (d: number) => new Date(now.getTime() + d * DAY_MS);
  assert.equal(expiryReminderBand(inDays(90), now), null);
  assert.equal(expiryReminderBand(inDays(45), now), 60);
  assert.equal(expiryReminderBand(inDays(20), now), 30);
  assert.equal(expiryReminderBand(inDays(3), now), 7);
  assert.equal(expiryReminderBand(inDays(-1), now), 0);
});

test("patient reminder window and visit-recording nudge", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const at = (h: number) => new Date(now.getTime() + h * HOUR_MS);
  assert.ok(appointmentReminderDue(at(24), now));
  assert.ok(!appointmentReminderDue(at(30), now));
  assert.ok(!appointmentReminderDue(at(1), now));
  assert.ok(visitNeedsRecording(at(-4), 30, now));
  assert.ok(!visitNeedsRecording(at(-1), 30, now));
});

test("90-day re-check is due on or after its date", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  assert.ok(recheckDue(new Date("2026-11-06T12:00:00Z"), now));
  assert.ok(!recheckDue(new Date("2026-11-07T00:00:00Z"), now));
  assert.ok(!recheckDue(null, now));
});

test("patient emails never carry visit reasons or insurance", () => {
  const m = messages.appointmentReminder("Ann Lee", "Dr. Jane Smith", "Monday, November 9 at 9:00 AM EST", "Peachtree Ortho", "https://x/appointments/t");
  assert.doesNotMatch(m.body, /reason|insurance|diagnos/i);
  assert.match(m.body, /cancel/);
});
