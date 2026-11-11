"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVerifiedClinician } from "@/lib/session";
import { bookingFeeCents, isGovernmentPlan } from "@/lib/fees";
import { STATES } from "@/lib/labels";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";
import { bookingCancelled, bookingConfirmation, bookingRescheduled, newBookingForClinician, reviewInvite, send } from "@/lib/email";
import { insuranceChanged } from "@/lib/reviews";
import { visitFacts } from "@/lib/visit";
import { fmtSlot } from "@/lib/time";

const withClinician = { slot: { include: { clinician: { include: { user: { select: { name: true, email: true } } } } } } } as const;

export type BookState = { error?: string } | undefined;

const bookSchema = z.object({
  slotId: z.string().min(1),
  patientName: z.string().trim().min(2, "Enter your full name").max(120),
  patientEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  patientPhone: z.string().trim().regex(/^[\d\s()+.-]{10,20}$/, "Enter a valid phone number"),
  insurance: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(300).optional(),
  newPatient: z.enum(["yes", "no"]),
  governmentPlan: z.literal("on").optional(),
  consent: z.literal("on", { errorMap: () => ({ message: "Please agree to the booking terms" }) }),
});

export async function bookSlot(_: BookState, form: FormData): Promise<BookState> {
  const parsed = bookSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!hit("booking", await clientIp())) return { error: "Too many bookings from this connection. Please try again later." };
  const token = randomBytes(24).toString("base64url");
  try {
    await db.$transaction(async (tx) => {
      // Only one booking can win a slot: the update matches OPEN slots only.
      const claimed = await tx.availabilitySlot.updateMany({
        where: { id: d.slotId, status: "OPEN", startsAt: { gt: new Date() }, clinician: { bookable: true, status: "VERIFIED" } },
        data: { status: "BOOKED" },
      });
      if (claimed.count !== 1) throw new Error("taken");
      await tx.appointment.create({
        data: {
          slotId: d.slotId,
          patientName: d.patientName,
          patientEmail: d.patientEmail,
          patientPhone: d.patientPhone,
          insurance: d.insurance || null,
          reason: d.reason || null,
          newPatient: d.newPatient === "yes",
          governmentPlan: d.governmentPlan === "on" || isGovernmentPlan(d.insurance),
          accessToken: token,
        },
      });
    });
  } catch {
    return { error: "Sorry, that time was just taken. Please choose another." };
  }
  const appt = await db.appointment.findUnique({ where: { accessToken: token }, include: withClinician });
  if (appt) {
    const c = appt.slot.clinician;
    await send(bookingConfirmation(appt.patientEmail, visitFacts(appt)));
    await send(newBookingForClinician(c.user.email, fmtSlot(appt.slot.startsAt, c.officeState, "long")));
  }
  redirect(`/appointments/${token}`);
}

/**
 * A cancelled appointment keeps its slot for the record, so the same time is
 * offered again as a fresh slot.
 */
async function reopen(slot: { id: string; clinicianId: string; startsAt: Date; minutes: number }) {
  await db.availabilitySlot.update({ where: { id: slot.id }, data: { status: "REMOVED" } });
  if (slot.startsAt > new Date()) {
    await db.availabilitySlot.create({ data: { clinicianId: slot.clinicianId, startsAt: slot.startsAt, minutes: slot.minutes } });
  }
}

export async function cancelByPatient(form: FormData) {
  const token = String(form.get("token"));
  const appt = await db.appointment.findUnique({ where: { accessToken: token }, include: withClinician });
  if (!appt || appt.status !== "BOOKED") return;
  await db.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" } });
  await reopen(appt.slot);
  await send(bookingCancelled(appt.patientEmail, visitFacts(appt)));
  revalidatePath(`/appointments/${token}`);
}

/**
 * The patient moves their visit to another open time with the same clinician.
 * The new slot is claimed first, so the patient never ends up with no visit.
 * Free for the practice and the patient; the booking fee still follows the
 * visit, not the number of changes.
 */
export async function rescheduleByPatient(_: BookState, form: FormData): Promise<BookState> {
  const token = String(form.get("token"));
  const newSlotId = String(form.get("slotId"));
  if (!hit("booking", await clientIp())) return { error: "Too many changes from this connection. Please try again later." };
  const appt = await db.appointment.findUnique({ where: { accessToken: token }, include: withClinician });
  if (!appt || appt.status !== "BOOKED") return { error: "This appointment can't be changed." };
  if (appt.slot.startsAt <= new Date()) return { error: "This visit has already started. Please call the office." };
  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.availabilitySlot.updateMany({
        where: { id: newSlotId, clinicianId: appt.slot.clinicianId, status: "OPEN", startsAt: { gt: new Date() } },
        data: { status: "BOOKED" },
      });
      if (claimed.count !== 1) throw new Error("taken");
      await tx.appointment.update({ where: { id: appt.id }, data: { slotId: newSlotId, reminderSentAt: null } });
    });
  } catch {
    return { error: "Sorry, that time was just taken. Please choose another." };
  }
  await reopen(appt.slot);
  const moved = await db.appointment.findUnique({ where: { id: appt.id }, include: withClinician });
  if (moved) {
    await send(bookingRescheduled(moved.patientEmail, visitFacts(moved)));
    await send(newBookingForClinician(moved.slot.clinician.user.email, `${fmtSlot(moved.slot.startsAt, moved.slot.clinician.officeState, "long")} (moved from ${fmtSlot(appt.slot.startsAt, appt.slot.clinician.officeState, "long")})`));
  }
  revalidatePath(`/appointments/${token}`);
  return {};
}

const profileSchema = z.object({
  bookable: z.enum(["on", "off"]).default("off"),
  bio: z.string().trim().max(600).optional(),
  officeName: z.string().trim().min(2, "Enter the office name").max(120),
  officeAddress: z.string().trim().min(4, "Enter the office address").max(200),
  officeCity: z.string().trim().min(2, "Enter the city").max(80),
  officeState: z.enum(STATES as [string, ...string[]]),
  insurance: z.string().trim().max(400).optional(),
  selfPay: z.string().trim().regex(/^\d{0,5}$/, "Enter a whole-dollar price").optional(),
  visitMinutes: z.coerce.number().int().min(10).max(120),
  confirmInsurance: z.literal("on").optional(),
});

export async function saveBookingProfile(_: BookState, form: FormData): Promise<BookState> {
  const user = await requireVerifiedClinician();
  const parsed = profileSchema.safeParse({ bookable: form.get("bookable") ?? "off", ...Object.fromEntries(form) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  // Saving a changed list, or ticking "still correct", stamps today's date.
  const confirmed = d.confirmInsurance === "on" || insuranceChanged(user.clinician.insurance, d.insurance || null);
  await db.clinicianProfile.update({
    where: { id: user.clinician.id },
    data: {
      ...(confirmed ? { insuranceConfirmedAt: new Date() } : {}),
      bookable: d.bookable === "on",
      bio: d.bio || null,
      officeName: d.officeName,
      officeAddress: d.officeAddress,
      officeCity: d.officeCity,
      officeState: d.officeState,
      insurance: d.insurance || null,
      selfPayCents: d.selfPay ? Number(d.selfPay) * 100 : null,
      visitMinutes: d.visitMinutes,
    },
  });
  revalidatePath("/schedule");
  return {};
}

const slotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  tzOffset: z.coerce.number().int().min(-900).max(900),
});

/** Opens back-to-back visits between start and end on one day. */
export async function addSlots(_: BookState, form: FormData): Promise<BookState> {
  const user = await requireVerifiedClinician();
  const parsed = slotsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Choose a date, start time and end time" };
  const { date, start, end, tzOffset } = parsed.data;
  const toUtc = (hm: string) => new Date(Date.parse(`${date}T${hm}:00Z`) + tzOffset * 60_000);
  const from = toUtc(start);
  const to = toUtc(end);
  const mins = user.clinician.visitMinutes;
  if (to <= from) return { error: "End time must be after start time" };
  if (from < new Date()) return { error: "Choose a time in the future" };
  const existing = await db.availabilitySlot.findMany({
    where: { clinicianId: user.clinician.id, status: { not: "REMOVED" }, startsAt: { gte: from, lt: to } },
    select: { startsAt: true },
  });
  const taken = new Set(existing.map((s) => s.startsAt.getTime()));
  const rows = [];
  for (let t = from.getTime(); t + mins * 60_000 <= to.getTime(); t += mins * 60_000) {
    if (!taken.has(t)) rows.push({ clinicianId: user.clinician.id, startsAt: new Date(t), minutes: mins });
  }
  if (rows.length === 0) return { error: "Those times are already open" };
  await db.availabilitySlot.createMany({ data: rows });
  revalidatePath("/schedule");
  return {};
}

export async function removeSlot(form: FormData) {
  const user = await requireVerifiedClinician();
  await db.availabilitySlot.updateMany({
    where: { id: String(form.get("slotId")), clinicianId: user.clinician.id, status: "OPEN" },
    data: { status: "REMOVED" },
  });
  revalidatePath("/schedule");
}

/** The clinician records how the visit went. The fee is computed here. */
export async function recordVisit(form: FormData) {
  const user = await requireVerifiedClinician();
  const id = String(form.get("appointmentId"));
  const outcome = String(form.get("outcome"));
  if (!["COMPLETED", "NO_SHOW", "CANCELLED"].includes(outcome)) return;
  const appt = await db.appointment.findFirst({ where: { id, slot: { clinicianId: user.clinician.id } }, include: withClinician });
  if (!appt || appt.status !== "BOOKED") return;
  await db.appointment.update({
    where: { id },
    data: { status: outcome, feeCents: bookingFeeCents({ ...appt, status: outcome }) },
  });
  if (outcome === "COMPLETED") await send(reviewInvite(appt.patientEmail, visitFacts(appt)));
  // The office cancelled: tell the patient and reopen the time if it's still ahead.
  if (outcome === "CANCELLED") {
    await reopen(appt.slot);
    await send(bookingCancelled(appt.patientEmail, visitFacts(appt)));
  }
  revalidatePath("/schedule");
}
