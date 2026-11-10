import { test } from "node:test";
import assert from "node:assert/strict";
import { adTags, cleanTag, cleanUsPhone, leadAlert, leadsByAd, practiceWelcome } from "../src/lib/leads";
import { slotCost } from "../src/lib/slot-cost";

test("ad tags are cleaned and capped", () => {
  assert.equal(cleanTag(" Meta "), "meta");
  assert.equal(cleanTag("angle-a_static1<script>"), "angle-a_static1script");
  assert.equal(cleanTag("x".repeat(80))?.length, 60);
  assert.equal(cleanTag(""), null);
  assert.equal(cleanTag(undefined), null);
});

test("patients are never tagged with the ad that brought them", () => {
  const raw = { utm_source: "meta", utm_campaign: "test1", utm_content: "a1" };
  assert.deepEqual(adTags("PATIENT", raw), { utmSource: null, utmCampaign: null, utmContent: null });
  assert.deepEqual(adTags("PRACTICE", raw), { utmSource: "meta", utmCampaign: "test1", utmContent: "a1" });
});

test("US phone numbers only", () => {
  assert.equal(cleanUsPhone("(404) 555-0123"), "+14045550123");
  assert.equal(cleanUsPhone("1-404-555-0123"), "+14045550123");
  assert.equal(cleanUsPhone("555-0123"), null);
  assert.equal(cleanUsPhone("(104) 555-0123"), null);
});

test("leads are grouped by ad, most first", () => {
  const row = (content: string | null, consent = false, deposit = false) => ({
    utmSource: content ? "meta" : null, utmCampaign: content ? "test1" : null, utmContent: content, depositIntent: deposit, contactConsent: consent,
  });
  const out = leadsByAd([row("a1", true), row("b1"), row("a1", false, true), row(null)]);
  assert.deepEqual(out[0], { source: "meta", campaign: "test1", content: "a1", leads: 2, canContact: 1, deposit: 1 });
  assert.equal(out.find((o) => o.source === "direct")?.leads, 1);
});

test("the lead alert says when a practice can't be called", () => {
  const base = { email: "om@example.com", state: "GA", city: "Atlanta", depositIntent: false, utmSource: "meta", utmCampaign: "test1", utmContent: "a1" };
  assert.match(leadAlert({ ...base, phone: "+14045550123", contactConsent: false }, "https://x").body, /email only/);
  assert.match(leadAlert({ ...base, phone: "+14045550123", contactConsent: true }, "https://x").body, /OK to call or text/);
  assert.match(leadAlert({ ...base, phone: null, contactConsent: false }, "https://x").body, /meta \/ test1 \/ a1/);
});

test("the practice email links the calculator and says it's automated", () => {
  const m = practiceWelcome("https://app.example");
  assert.match(m.body, /https:\/\/app\.example\/calculator/);
  assert.match(m.body, /automated/);
});

test("slot calculator matches the lead magnet example and ignores nonsense", () => {
  assert.deepEqual(slotCost({ visitsPerDay: 18, perVisit: 110, daysPerMonth: 18, monthsOpen: 4 }), { monthly: 35_640, soFar: 142_560 });
  assert.deepEqual(slotCost({ visitsPerDay: NaN, perVisit: 110, daysPerMonth: 18, monthsOpen: 4 }), { monthly: 0, soFar: 0 });
  assert.equal(slotCost({ visitsPerDay: 18, perVisit: 110, daysPerMonth: 99, monthsOpen: 1 }).monthly, 18 * 110 * 31);
});
