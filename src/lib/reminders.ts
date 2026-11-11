import type { PrismaClient } from "@prisma/client";
import { bookingReminder, send } from "./email";
import { visitFacts } from "./visit";
import { fmtSlot } from "./time";
import { reminderText, smsTransport, toE164, type SmsTransport } from "./sms";

/**
 * Sends one reminder for each booked visit starting in the next 24 hours.
 * Safe to run as often as you like (for example every 15 minutes): each
 * appointment is reminded once.
 */
export async function sendDueReminders(db: PrismaClient, now = new Date()): Promise<number> {
  const due = await db.appointment.findMany({
    where: {
      status: "BOOKED",
      reminderSentAt: null,
      slot: { startsAt: { gt: now, lte: new Date(now.getTime() + 24 * 3_600_000) } },
    },
    include: { slot: { include: { clinician: { include: { user: { select: { name: true } } } } } } },
  });
  let sent = 0;
  for (const a of due) {
    // Claim first so two runs at once can't both send.
    const claimed = await db.appointment.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count !== 1) continue;
    await send(bookingReminder(a.patientEmail, visitFacts(a)));
    sent++;
  }
  return sent;
}

/**
 * One text reminder per opted-in visit in the next 24 hours, alongside the
 * email. Claimed before sending, so a crash never sends twice; a failed send
 * is not retried (the email reminder still goes).
 */
export async function sendDueTextReminders(db: PrismaClient, now = new Date(), t: SmsTransport = smsTransport(), appUrl = process.env.APP_URL ?? "http://localhost:3000"): Promise<number> {
  if (t.name === "off") return 0;
  const due = await db.appointment.findMany({
    where: {
      status: "BOOKED",
      smsOptIn: true,
      smsReminderSentAt: null,
      slot: { startsAt: { gt: now, lte: new Date(now.getTime() + 24 * 3_600_000) } },
    },
    include: { slot: { include: { clinician: { select: { officeState: true } } } } },
  });
  let sent = 0;
  for (const a of due) {
    const to = toE164(a.patientPhone);
    const claimed = await db.appointment.updateMany({ where: { id: a.id, smsReminderSentAt: null }, data: { smsReminderSentAt: now } });
    if (claimed.count !== 1 || !to) continue;
    const when = fmtSlot(a.slot.startsAt, a.slot.clinician.officeState, "long");
    try {
      if (await t.send({ to, body: reminderText(when, `${appUrl.replace(/\/$/, "")}/appointments/${a.accessToken}`) })) sent++;
    } catch (e) {
      console.error("[sms] reminder failed", (e as Error).message);
    }
  }
  return sent;
}
