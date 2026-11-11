import { db } from "./db";
import { decryptToken, encryptToken, fetchBusy, planSlotChanges, refreshAccess, SYNC_DAYS, type Busy, type Provider } from "./calendar";

/**
 * Reads busy times from every calendar a clinician linked and hides or
 * restores their open slots. If any calendar fails, nothing changes for that
 * clinician this run, so an outage never reopens a time they are busy.
 */
export async function syncClinicianCalendars(clinicianId: string, now = new Date()): Promise<{ hidden: number; reopened: number; ok: boolean }> {
  const links = await db.calendarLink.findMany({ where: { clinicianId } });
  if (links.length === 0) return { hidden: 0, reopened: 0, ok: true };
  const to = new Date(now.getTime() + SYNC_DAYS * 86_400_000);
  const busy: Busy[] = [];
  let ok = true;
  for (const l of links) {
    try {
      const { accessToken, rotated } = await refreshAccess(l.provider as Provider, decryptToken(l.refreshTokenEnc));
      busy.push(...(await fetchBusy(l.provider as Provider, accessToken, now, to)));
      await db.calendarLink.update({
        where: { id: l.id },
        data: { syncedAt: now, error: null, ...(rotated ? { refreshTokenEnc: encryptToken(rotated) } : {}) },
      });
    } catch (e) {
      ok = false;
      await db.calendarLink.update({ where: { id: l.id }, data: { error: (e as Error).message.slice(0, 300) } });
    }
  }
  if (!ok) return { hidden: 0, reopened: 0, ok };
  const slots = await db.availabilitySlot.findMany({
    where: { clinicianId, status: { in: ["OPEN", "BUSY"] }, startsAt: { gt: now, lt: to } },
  });
  const plan = planSlotChanges(slots, busy);
  // Status guards make each change a no-op if a patient booked in between.
  const hidden = plan.hide.length
    ? (await db.availabilitySlot.updateMany({ where: { id: { in: plan.hide }, status: "OPEN" }, data: { status: "BUSY" } })).count
    : 0;
  const reopened = plan.reopen.length
    ? (await db.availabilitySlot.updateMany({ where: { id: { in: plan.reopen }, status: "BUSY" }, data: { status: "OPEN" } })).count
    : 0;
  return { hidden, reopened, ok };
}

/** All clinicians with a linked calendar. Used by the hourly automation. */
export async function syncAllCalendars(now = new Date()) {
  const ids = await db.calendarLink.findMany({ distinct: ["clinicianId"], select: { clinicianId: true } });
  let hidden = 0;
  let reopened = 0;
  let failed = 0;
  for (const { clinicianId } of ids) {
    const r = await syncClinicianCalendars(clinicianId, now);
    hidden += r.hidden;
    reopened += r.reopened;
    if (!r.ok) failed++;
  }
  return `${ids.length} calendar${ids.length === 1 ? "" : "s"} synced: ${hidden} slots hidden, ${reopened} reopened, ${failed} failed`;
}
