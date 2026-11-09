import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hit, resetLimits, LIMITS } from "../src/lib/ratelimit";
import { bookingConfirmation, bookingReminder, newBookingForClinician, sentEmails } from "../src/lib/email";
import { sendDueReminders } from "../src/lib/reminders";

test("rate limiter blocks after the limit and resets after the window", () => {
  resetLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < LIMITS.login.max; i++) assert.ok(hit("login", "1.2.3.4", t0));
  assert.equal(hit("login", "1.2.3.4", t0), false);
  assert.ok(hit("login", "5.6.7.8", t0), "other keys are unaffected");
  assert.ok(hit("login", "1.2.3.4", t0 + LIMITS.login.windowMs), "a new window opens");
});

test("emails carry no visit reason or insurance, and clinician emails carry no patient details", () => {
  const v = { when: "Tue, Nov 10, 9:00 AM EST", clinician: "Sam Lee, DPT", office: "Peachtree PT, Atlanta, GA", manageUrl: "http://x/appointments/abc" };
  for (const e of [bookingConfirmation("p@example.com", v), bookingReminder("p@example.com", v)]) {
    assert.match(e.text, /Sam Lee/);
    assert.doesNotMatch(e.text, /knee|aetna|insurance|reason/i);
  }
  const c = newBookingForClinician("c@example.com", v.when);
  assert.doesNotMatch(c.text, /p@example\.com|Pat/);
});

const db = new PrismaClient();
after(() => db.$disconnect());

test("reminders go out once per visit in the next 24 hours", async () => {
  const tag = randomBytes(4).toString("hex");
  const now = new Date("2030-01-01T12:00:00Z");
  const user = await db.user.create({
    data: {
      email: `rem-${tag}@example.com`, passwordHash: "x", name: "Test Clinician", role: "CLINICIAN",
      clinician: { create: { profession: "PT", specialty: "Sports", licenseState: "GA", licenseNumber: tag, region: "Southeast", bookable: true, officeName: "Test PT", officeState: "GA" } },
    },
    include: { clinician: true },
  });
  const cid = user.clinician!.id;
  const mk = async (hours: number, email: string) => {
    const slot = await db.availabilitySlot.create({ data: { clinicianId: cid, startsAt: new Date(now.getTime() + hours * 3_600_000), minutes: 30, status: "BOOKED" } });
    await db.appointment.create({ data: { slotId: slot.id, patientName: "Pat", patientEmail: email, patientPhone: "555", accessToken: `${tag}-${hours}` } });
  };
  try {
    await mk(3, `soon-${tag}@example.com`);
    await mk(30, `later-${tag}@example.com`);
    const before = sentEmails().length;
    assert.equal(await sendDueReminders(db, now), 1);
    assert.equal(await sendDueReminders(db, now), 0, "second run sends nothing");
    const sent = sentEmails().slice(before);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, `soon-${tag}@example.com`);
  } finally {
    await db.appointment.deleteMany({ where: { accessToken: { startsWith: tag } } });
    await db.user.delete({ where: { id: user.id } });
  }
});
