"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVerifiedClinician } from "@/lib/session";
import { syncClinicianCalendars } from "@/lib/calendar-sync";

export async function syncCalendarNow() {
  const user = await requireVerifiedClinician();
  await syncClinicianCalendars(user.clinician.id);
  revalidatePath("/schedule");
}

/** Unlinks a calendar and brings back every time it was hiding. */
export async function disconnectCalendar(form: FormData) {
  const user = await requireVerifiedClinician();
  const provider = String(form.get("provider"));
  await db.calendarLink.deleteMany({ where: { clinicianId: user.clinician.id, provider } });
  const left = await db.calendarLink.count({ where: { clinicianId: user.clinician.id } });
  if (left === 0) await db.availabilitySlot.updateMany({ where: { clinicianId: user.clinician.id, status: "BUSY" }, data: { status: "OPEN" } });
  else await syncClinicianCalendars(user.clinician.id);
  revalidatePath("/schedule");
}
