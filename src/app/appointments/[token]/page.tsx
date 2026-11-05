import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { PROFESSIONS } from "@/lib/labels";
import { cancelByPatient } from "../../actions/booking";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Appointment({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await db.appointment.findUnique({
    where: { accessToken: token },
    include: { slot: { include: { clinician: { include: { user: { select: { name: true } } } } } } },
  });
  if (!a) notFound();
  const c = a.slot.clinician;
  const when = fmtSlot(a.slot.startsAt, c.officeState, "long");
  return (
    <div className="max-w-xl flex flex-col gap-5">
      <h1 className="h1">{a.status === "CANCELLED" ? "Appointment cancelled" : "You're booked"}</h1>
      <div className="card flex flex-col gap-1">
        <span className="font-semibold text-lg">{when}</span>
        <span>{c.user.name}, {PROFESSIONS[c.profession]}</span>
        <span className="text-muted">{c.officeName}, {c.officeAddress}, {c.officeCity}, {c.officeState}</span>
        <span className="text-sm text-muted mt-2">Booked for {a.patientName}. Keep this page&apos;s link to view or cancel.</span>
      </div>
      {a.status === "BOOKED" && (
        <form action={cancelByPatient}>
          <input type="hidden" name="token" value={token} />
          <button className="btn-soft">Cancel this appointment</button>
        </form>
      )}
    </div>
  );
}
