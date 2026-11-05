import { test } from "node:test";
import assert from "node:assert/strict";
import { billRateCents, hourlyFeeCents, conversionFeeCents, listingMoney, PERMANENT_HIRE_FEE_CENTS } from "../src/lib/fees";
import { findIdentifiers } from "../src/lib/identifiers";
import { isValidNpi } from "../src/lib/npi";
import { anonLabel } from "../src/lib/labels";

test("locums: clinician keeps 100%, practice pays 12% on top", () => {
  assert.equal(billRateCents(25_000), 28_000);
  assert.equal(hourlyFeeCents(25_000), 3_000);
});

test("conversion fee falls from $9,500 to $0 over 12 months", () => {
  assert.equal(conversionFeeCents(0), PERMANENT_HIRE_FEE_CENTS);
  assert.equal(conversionFeeCents(6), 475_000);
  assert.equal(conversionFeeCents(12), 0);
  assert.equal(conversionFeeCents(30), 0);
  for (let m = 1; m <= 12; m++) assert.ok(conversionFeeCents(m) <= conversionFeeCents(m - 1));
});

test("every listing shows practice pays, take-home and fee", () => {
  const m = listingMoney({ type: "LOCUMS", payUnit: "HOUR", payMinCents: 26_800, payMaxCents: 26_800 });
  assert.equal(m.youTakeHome, "$268/hr");
  assert.equal(m.practicePays, "$300.16/hr");
  assert.match(m.ourFee, /12% on top/);
  const p = listingMoney({ type: "PERMANENT", payUnit: "YEAR", payMinCents: 12_500_000, payMaxCents: 14_000_000 });
  assert.equal(p.youTakeHome, "$125,000 to $140,000/yr");
  assert.match(p.ourFee, /\$9,500 flat/);
});

test("identifier check flags obvious patient details", () => {
  assert.deepEqual(findIdentifiers("How fast do you progress running after ACL?"), []);
  assert.ok(findIdentifiers("Pt DOB 3/4/1961, MRN 4482913").length >= 2);
  assert.ok(findIdentifiers("call her at 404-555-0182").includes("phone number"));
});

test("NPI check digit", () => {
  assert.equal(isValidNpi("1234567893"), true);
  assert.equal(isValidNpi("1234567890"), false);
  assert.equal(isValidNpi("12345"), false);
});

test("anonymous label reveals role and region only", () => {
  assert.equal(anonLabel("Orthopedic surgeon", "PHYSICIAN", "GA"), "Orthopedic surgeon, Southeast");
  assert.equal(anonLabel("ICU", "NURSE", "TX"), "Nurse, Texas");
});

import { bookingFeeCents } from "../src/lib/fees";

test("booking fee only for completed new-patient visits found on FindYourDoc", () => {
  const base = { status: "COMPLETED", newPatient: true, source: "FINDYOURDOC" };
  assert.equal(bookingFeeCents(base), 4_000);
  assert.equal(bookingFeeCents({ ...base, status: "NO_SHOW" }), 0);
  assert.equal(bookingFeeCents({ ...base, status: "CANCELLED" }), 0);
  assert.equal(bookingFeeCents({ ...base, newPatient: false }), 0);
  assert.equal(bookingFeeCents({ ...base, source: "PRACTICE_SITE" }), 0);
});

import { matchesCare, acceptsInsurance } from "../src/lib/search";

test("patients can find PTs and NPs in plain language", () => {
  const pt = { profession: "PT", specialty: "Sports and knee rehab", bio: null };
  const np = { profession: "NP", specialty: "Family practice", bio: null };
  const ortho = { profession: "PHYSICIAN", specialty: "Orthopedic surgeon", bio: null };
  assert.ok(matchesCare("knee pain", pt));
  assert.ok(matchesCare("knee pain", ortho));
  assert.ok(matchesCare("physical therapist", pt));
  assert.ok(matchesCare("flu", np));
  assert.ok(!matchesCare("skin rash", pt));
  assert.ok(matchesCare("", np));
});

test("insurance filter", () => {
  assert.ok(acceptsInsurance("Aetna", "Aetna, Cigna"));
  assert.ok(!acceptsInsurance("Humana", "Aetna, Cigna"));
  assert.ok(acceptsInsurance("self-pay", null));
});

import { fmtSlot } from "../src/lib/time";

test("times show in the office's time zone", () => {
  const d = new Date("2026-11-06T14:00:00Z");
  assert.equal(fmtSlot(d, "GA", "time"), "9:00 AM");
  assert.equal(fmtSlot(d, "TX", "time"), "8:00 AM");
  assert.equal(fmtSlot(d, "CA", "time"), "6:00 AM");
});
