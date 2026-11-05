"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVerifiedClinician } from "@/lib/session";
import { bookingFeeCents } from "@/lib/fees";
import { STATES } from "@/lib/labels";

export type BookState = { error?: string } | undefined;

const bookSchema = z.object({
  slotId: z.string().min(1),
  patientName: z.string().trim().min(2, "Enter your full name").max(120),
  patientEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  patientPhone: z.string().trim().regex(/^[\d\s()+.-]{10,20}$/, "Enter a valid phone number"),
  insurance: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(300).optional(),
  newPatient: z.enum(["yes", "no"]),
  consent: z.literal("on", { errorMap: () => ({ message: "Please agree to the booking terms" }) }),
});

export async function bookSlot(_: BookState, form: FormData): Promise<BookState> {
  const parsed = bookSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
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
          accessToken: token,
        },
      });
    });
  } catch {
    return { error: "Sorry, that time was just taken. Please choose another." };
  }
  redirect(`/appointments/${token}`);
}

export async function cancelByPatient(form: FormData) {
  const token = String(form.get("token"));
  const appt = await db.appointment.findUnique({ where: { accessToken: token }, include: { slot: true } });
  if (!appt || appt.status !== "BOOKED") return;
  await db.$transaction([
    db.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" } }),
    // Reopen the time so another patient can take it.
    db.availabilitySlot.update({ where: { id: appt.slotId }, data: { status: appt.slot.startsAt > new Date() ? "OPEN" : "REMOVED" } }),
  ]);
  revalidatePath(`/appointments/${token}`);
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
});

export async function saveBookingProfile(_: BookState, form: FormData): Promise<BookState> {
  const user = await requireVerifiedClinician();
  const parsed = profileSchema.safeParse({ bookable: form.get("bookable") ?? "off", ...Object.fromEntries(form) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.clinicianProfile.update({
    where: { id: user.clinician.id },
    data: {
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
  const appt = await db.appointment.findFirst({ where: { id, slot: { clinicianId: user.clinician.id } } });
  if (!appt || appt.status !== "BOOKED") return;
  await db.appointment.update({
    where: { id },
    data: { status: outcome, feeCents: bookingFeeCents({ ...appt, status: outcome }) },
  });
  revalidatePath("/schedule");
}
