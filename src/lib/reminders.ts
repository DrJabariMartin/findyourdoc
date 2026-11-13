import type { PrismaClient } from "@prisma/client";
import { bookingReminder, send } from "./email";
import { visitFacts } from "./visit";

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
