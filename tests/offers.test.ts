import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLANS,
  PERMANENT_HIRE_FEE_CENTS,
  permanentHireFeeCents,
  replacementLocumsFeeWaived,
  conciergeMonthCents,
} from "../src/lib/fees";
import { whoCanHelp } from "../src/lib/search";
import { rankWaitlistStates } from "../src/lib/waitlist";

test("three tiers: self-serve, core, done for you, in price order", () => {
  assert.deepEqual(PLANS.map((p) => p.id), ["SOLO", "GROUP", "CONCIERGE"]);
  assert.deepEqual(PLANS.map((p) => p.monthlyCents), [29_900, 79_900, 199_900]);
});

test("90-day hire guarantee: next hire has no fee if the last one left early", () => {
  assert.equal(permanentHireFeeCents(), PERMANENT_HIRE_FEE_CENTS);
  assert.equal(permanentHireFeeCents(30), 0);
  assert.equal(permanentHireFeeCents(89), 0);
  assert.equal(permanentHireFeeCents(90), PERMANENT_HIRE_FEE_CENTS);
});

test("locums cancellation guarantee covers the last 14 days", () => {
  assert.equal(replacementLocumsFeeWaived(3), true);
  assert.equal(replacementLocumsFeeWaived(13), true);
  assert.equal(replacementLocumsFeeWaived(14), false);
});

test("Concierge month is waived when any role misses its 14-day shortlist", () => {
  assert.equal(conciergeMonthCents([{ openedDaysAgo: 20, daysToShortlist: 10 }]), 199_900);
  assert.equal(conciergeMonthCents([{ openedDaysAgo: 5, daysToShortlist: null }]), 199_900);
  assert.equal(conciergeMonthCents([{ openedDaysAgo: 20, daysToShortlist: 16 }]), 0);
  assert.equal(conciergeMonthCents([{ openedDaysAgo: 15, daysToShortlist: null }]), 0);
});

test("who can help: names professions for plain-language needs", () => {
  assert.ok(whoCanHelp("knee pain").includes("physical therapists"));
  assert.ok(whoCanHelp("Anxiety").includes("psychiatrists"));
  assert.deepEqual(whoCanHelp("zzz"), []);
});

test("waitlist ranks deposit-ready practices first", () => {
  const rows = rankWaitlistStates([
    { state: "TX", role: "PATIENT", depositIntent: false, count: 50 },
    { state: "GA", role: "PRACTICE", depositIntent: true, count: 2 },
    { state: "GA", role: "CLINICIAN", depositIntent: false, count: 10 },
    { state: "TX", role: "PRACTICE", depositIntent: false, count: 5 },
  ]);
  assert.deepEqual(rows.map((r) => r.state), ["GA", "TX"]);
  assert.equal(rows[0].depositPractices, 2);
  assert.equal(rows[1].practices, 5);
  assert.equal(rows[1].patients, 50);
});
