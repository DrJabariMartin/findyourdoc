"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireVerifiedClinician } from "@/lib/session";
import { canReview, REPORT_REASONS } from "@/lib/reviews";
import { findIdentifiers } from "@/lib/identifiers";

export type ReviewState = { error?: string; ok?: boolean } | undefined;

const reviewSchema = z.object({
  token: z.string().min(10),
  rating: z.coerce.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"),
  body: z.string().trim().max(1500).optional(),
});

/** The patient writes or edits their review, using the private link from their booking. */
export async function saveReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const appt = await db.appointment.findUnique({ where: { accessToken: d.token }, include: { slot: true } });
  if (!appt || !canReview(appt)) return { error: "Reviews open after a completed visit." };
  // A patient's own details don't belong in a public review.
  if (d.body && findIdentifiers(d.body).length) return { error: "Please remove phone numbers, emails, addresses or dates from your review." };
  const data = { rating: d.rating, body: d.body || null };
  await db.review.upsert({
    where: { appointmentId: appt.id },
    create: { ...data, appointmentId: appt.id, clinicianId: appt.slot.clinicianId },
    // An edit by the patient puts a reported review back on show: it's their words.
    update: { ...data, status: "SHOWN", reportReason: null },
  });
  revalidatePath(`/appointments/${d.token}`);
  revalidatePath(`/find/${appt.slot.clinicianId}`);
  return { ok: true };
}

export async function deleteReview(form: FormData) {
  const token = String(form.get("token"));
  const appt = await db.appointment.findUnique({ where: { accessToken: token }, include: { slot: true } });
  if (!appt) return;
  await db.review.deleteMany({ where: { appointmentId: appt.id } });
  revalidatePath(`/appointments/${token}`);
  revalidatePath(`/find/${appt.slot.clinicianId}`);
}

const replySchema = z.object({ reviewId: z.string().min(1), reply: z.string().trim().min(2).max(1000) });

/** One public reply per review. It must not confirm anything about the patient's care (HIPAA). */
export async function replyToReview(form: FormData) {
  const user = await requireVerifiedClinician();
  const parsed = replySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  await db.review.updateMany({
    where: { id: parsed.data.reviewId, clinicianId: user.clinician.id },
    data: { reply: parsed.data.reply, repliedAt: new Date() },
  });
  revalidatePath("/schedule");
  revalidatePath(`/find/${user.clinician.id}`);
}

/** A clinician reports a review. It stays visible until an admin decides. */
export async function reportReview(form: FormData) {
  const user = await requireVerifiedClinician();
  const reason = String(form.get("reason"));
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return;
  await db.review.updateMany({
    where: { id: String(form.get("reviewId")), clinicianId: user.clinician.id, status: "SHOWN" },
    data: { status: "REPORTED", reportReason: reason },
  });
  revalidatePath("/schedule");
}

/** Admin: keep a reported review (back to shown) or remove it for breaking the rules. */
export async function decideReview(form: FormData) {
  await requireAdmin();
  const id = String(form.get("reviewId"));
  const keep = form.get("verdict") === "keep";
  const r = await db.review.update({ where: { id }, data: keep ? { status: "SHOWN", reportReason: null } : { status: "REMOVED" } });
  revalidatePath("/admin");
  revalidatePath(`/find/${r.clinicianId}`);
}
