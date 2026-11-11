import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { canReview, insuranceChanged, insuranceStatus, summarize, REPORT_REASONS } from "../src/lib/reviews";
import { reviewInvite } from "../src/lib/email";

const DAY = 86_400_000;

test("only completed visits within a year can be reviewed", () => {
  const now = new Date("2030-06-01T12:00:00Z");
  const at = (d: number) => ({ startsAt: new Date(now.getTime() - d * DAY) });
  assert.ok(canReview({ status: "COMPLETED", slot: at(3) }, now));
  for (const status of ["BOOKED", "CANCELLED", "NO_SHOW"]) assert.equal(canReview({ status, slot: at(3) }, now), false);
  assert.equal(canReview({ status: "COMPLETED", slot: at(400) }, now), false);
});

test("rating summary counts every review, including 1-star ones", () => {
  assert.deepEqual(summarize([]), { count: 0, average: null, histogram: [0, 0, 0, 0, 0] });
  const s = summarize([5, 5, 4, 1]);
  assert.equal(s.count, 4);
  assert.equal(s.average, 3.8);
  assert.deepEqual(s.histogram, [2, 1, 0, 0, 1]);
});

test("insurance lists go stale after 90 days", () => {
  const now = new Date("2030-06-01T12:00:00Z");
  assert.equal(insuranceStatus(null, now).fresh, false);
  assert.equal(insuranceStatus(new Date(now.getTime() - 10 * DAY), now).fresh, true);
  const old = insuranceStatus(new Date(now.getTime() - 91 * DAY), now);
  assert.equal(old.fresh, false);
  assert.match(old.label, /Call to check/);
});

test("reordering or recasing the insurance list is not a change", () => {
  assert.equal(insuranceChanged("Aetna, Cigna", "cigna,aetna"), false);
  assert.equal(insuranceChanged("Aetna", "Aetna, Medicare"), true);
  assert.equal(insuranceChanged(null, ""), false);
});

test("review invite offers no incentive and asks for honest reviews", () => {
  const e = reviewInvite("p@example.com", { when: "Tue", clinician: "Sam Lee", office: "Office", manageUrl: "http://x/appointments/t" });
  assert.match(e.text, /good or bad/);
  assert.match(e.text, /edit or delete/);
  assert.doesNotMatch(e.text, /gift|discount|reward|credit|\$/i);
});

test("a low rating is never a reason to report a review", () => {
  for (const r of REPORT_REASONS) assert.doesNotMatch(r, /rating|negative|unfair|inaccurate/i);
});

const db = new PrismaClient();
after(() => db.$disconnect());

test("one review per appointment, and replies stay attached to their post", async () => {
  const tag = randomBytes(4).toString("hex");
  const user = await db.user.create({
    data: {
      email: `rev-${tag}@example.com`, passwordHash: "x", name: "Review Clinician", role: "CLINICIAN",
      clinician: { create: { profession: "PT", specialty: "Sports", licenseState: "MD", licenseNumber: `r${tag}`, region: "Mid-Atlantic", bookable: true, officeName: "Test PT", officeState: "MD" } },
    },
    include: { clinician: true },
  });
  const c = user.clinician!;
  const slot = await db.availabilitySlot.create({ data: { clinicianId: c.id, startsAt: new Date(Date.now() - DAY), minutes: 30, status: "BOOKED" } });
  const appt = await db.appointment.create({
    data: { slotId: slot.id, patientName: "Pat", patientEmail: `p-${tag}@example.com`, patientPhone: "4105550100", status: "COMPLETED", accessToken: `t-${tag}` },
  });
  await db.review.create({ data: { appointmentId: appt.id, clinicianId: c.id, rating: 2, body: "Long wait." } });
  await assert.rejects(db.review.create({ data: { appointmentId: appt.id, clinicianId: c.id, rating: 5 } }));

  const room = await db.room.create({ data: { slug: `r-${tag}`, name: "Test room" } });
  const post = await db.post.create({ data: { roomId: room.id, title: "Question", body: "A question for the room", authorId: user.id } });
  await db.reply.create({ data: { postId: post.id, body: "An answer", authorId: user.id } });
  const withReplies = await db.post.findUnique({ where: { id: post.id }, include: { replies: true } });
  assert.equal(withReplies?.replies.length, 1);
  await db.room.delete({ where: { id: room.id } });
  assert.equal(await db.reply.count({ where: { postId: post.id } }), 0, "replies go with their post");
});
