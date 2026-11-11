import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, fmtSlot, officeTimeToUtc } from "../src/lib/time";

test("office wall-clock times convert to UTC across daylight saving", () => {
  // Maryland: EST (UTC-5) in January, EDT (UTC-4) in July.
  assert.equal(officeTimeToUtc("2030-01-15", "09:00", "MD").toISOString(), "2030-01-15T14:00:00.000Z");
  assert.equal(officeTimeToUtc("2030-07-15", "09:00", "MD").toISOString(), "2030-07-15T13:00:00.000Z");
  // Arizona has no daylight saving.
  assert.equal(officeTimeToUtc("2030-07-15", "09:00", "AZ").toISOString(), "2030-07-15T16:00:00.000Z");
});

test("weekly repeats keep 9:00 at 9:00 when the clocks change", () => {
  // US clocks spring forward on 2030-03-10.
  for (let w = 0; w < 4; w++) {
    const day = addDays("2030-03-01", 7 * w);
    assert.match(fmtSlot(officeTimeToUtc(day, "09:00", "MD"), "MD", "time"), /^9:00\sAM$/);
  }
  assert.equal(addDays("2030-12-30", 7), "2031-01-06");
});
