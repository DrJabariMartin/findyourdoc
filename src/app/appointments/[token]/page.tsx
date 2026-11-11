import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { PROFESSIONS } from "@/lib/labels";
import { canReview } from "@/lib/reviews";
import { cancelByPatient, setEarlierAlert } from "../../actions/booking";
import { deleteReview } from "../../actions/reviews";
import { Reschedule, ReviewForm } from "./Forms";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const HEADINGS: Record<string, string> = {
  BOOKED: "You're booked",
  CANCELLED: "Appointment cancelled",
  COMPLETED: "Visit completed",
  NO_SHOW: "Visit missed",
};

export default async function Appointment({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await db.appointment.findUnique({
    where: { accessToken: token },
    include: { review: true, slot: { include: { clinician: { include: { user: { select: { name: true } } } } } } },
  });
  if (!a) notFound();
  const c = a.slot.clinician;
  const when = fmtSlot(a.slot.startsAt, c.officeState, "long");
  const others = a.status === "BOOKED"
    ? await db.availabilitySlot.findMany({ where: { clinicianId: c.id, status: "OPEN", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 40 })
    : [];
  return (
    <div className="max-w-xl flex flex-col gap-5">
      <h1 className="h1">{HEADINGS[a.status] ?? "Your appointment"}</h1>
      <div className="card flex flex-col gap-1">
        <span className="font-semibold text-lg">{when}</span>
        <span>{c.user.name}, {PROFESSIONS[c.profession]}</span>
        <span className="text-muted">{c.officeName}, {c.officeAddress}, {c.officeCity}, {c.officeState}</span>
        <span className="text-sm text-muted mt-2">Booked for {a.patientName}. Keep this page&apos;s link to view, change or cancel.</span>
      </div>
      {a.status === "BOOKED" && (
        <div className="flex flex-col gap-3">
          <Reschedule token={token} slots={others.map((s) => ({ id: s.id, label: fmtSlot(s.startsAt, c.officeState, "long") }))} />
          <form action={setEarlierAlert} className="card flex flex-col gap-2">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="on" value={a.earlierAlert ? "0" : "1"} />
            <span className="font-semibold">{a.earlierAlert ? "We'll email you if an earlier time opens" : "Want to be seen sooner?"}</span>
            <span className="text-sm text-muted">{a.earlierAlert ? "You'll get one email per earlier opening with this clinician. Your current time stays booked." : "Get an email when an earlier time opens with this clinician. Your current time stays booked."}</span>
            <button className="btn-soft self-start">{a.earlierAlert ? "Stop earlier-time emails" : "Email me about earlier times"}</button>
          </form>
          <form action={cancelByPatient}>
            <input type="hidden" name="token" value={token} />
            <button className="btn-soft">Cancel this appointment</button>
          </form>
          <p className="text-sm text-muted">There is never a fee or penalty for you if you change or cancel, or if the office cancels.</p>
        </div>
      )}
      {canReview(a) && (
        <>
          <ReviewForm token={token} rating={a.review?.rating} body={a.review?.body ?? undefined} />
          {a.review && (
            <form action={deleteReview}>
              <input type="hidden" name="token" value={token} />
              <button className="text-sm underline text-muted cursor-pointer">Delete my review</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
