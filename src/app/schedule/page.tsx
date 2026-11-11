import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { requireVerifiedClinician } from "@/lib/session";
import { dollars } from "@/lib/fees";
import { recordVisit, removeSlot } from "../actions/booking";
import { replyToReview, reportReview } from "../actions/reviews";
import { REPORT_REASONS, insuranceStatus, summarize } from "@/lib/reviews";
import { ProfileForm, SlotsForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function Schedule() {
  const user = await requireVerifiedClinician();
  const c = user.clinician;
  const now = new Date();
  const [open, appts, fees, reviews] = await Promise.all([
    db.availabilitySlot.findMany({ where: { clinicianId: c.id, status: "OPEN", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 60 }),
    db.appointment.findMany({ where: { slot: { clinicianId: c.id }, status: "BOOKED" }, include: { slot: true }, orderBy: { slot: { startsAt: "asc" } } }),
    db.appointment.aggregate({ where: { slot: { clinicianId: c.id }, status: "COMPLETED" }, _sum: { feeCents: true }, _count: true }),
    db.review.findMany({ where: { clinicianId: c.id, status: { not: "REMOVED" } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const rating = summarize(reviews.filter((r) => r.status === "SHOWN").map((r) => r.rating));
  const fmt = (d: Date) => fmtSlot(d, c.officeState ?? c.licenseState);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1">Patient booking</h1>
        <p className="text-ink-2 mt-1">Patients book open times directly. We charge {dollars(4000)} only when a new patient who found you here completes a visit. No-shows, cancellations, existing patients and patients from your own website are free.</p>
      </div>
      <div className="flex flex-wrap gap-6 items-start">
        <section className="flex-[1_1_340px] card flex flex-col gap-3">
          <h2 className="font-semibold text-lg">Your booking profile</h2>
          <ProfileForm c={{ bookable: c.bookable, bio: c.bio ?? "", officeName: c.officeName ?? "", officeAddress: c.officeAddress ?? "", officeCity: c.officeCity ?? "", officeState: c.officeState ?? c.licenseState, insurance: c.insurance ?? "", insuranceNote: insuranceStatus(c.insuranceConfirmedAt).label, selfPay: c.selfPayCents ? String(c.selfPayCents / 100) : "", visitMinutes: c.visitMinutes }} />
        </section>
        <section className="flex-[2_1_420px] flex flex-col gap-6">
          <div className="card flex flex-col gap-3">
            <h2 className="font-semibold text-lg">Upcoming appointments ({appts.length})</h2>
            {appts.length === 0 && <p className="text-muted">None yet.</p>}
            {appts.map((a) => (
              <div key={a.id} className="flex flex-wrap gap-3 items-center justify-between border-t border-line pt-3">
                <div className="flex flex-col">
                  <span className="font-semibold">{fmt(a.slot.startsAt)} · {a.patientName}</span>
                  <span className="text-sm text-muted">{a.newPatient ? "New patient" : "Existing patient"} · {a.insurance ?? "Self-pay"} · {a.patientPhone}{a.reason ? ` · ${a.reason}` : ""}</span>
                </div>
                <form action={recordVisit} className="flex gap-2">
                  <input type="hidden" name="appointmentId" value={a.id} />
                  <button name="outcome" value="COMPLETED" className="btn !py-2 !px-3 text-sm">Completed</button>
                  <button name="outcome" value="NO_SHOW" className="btn-soft text-sm">No-show</button>
                  <button name="outcome" value="CANCELLED" className="btn-soft text-sm">Cancelled</button>
                </form>
              </div>
            ))}
            <p className="text-sm text-muted">Completed visits so far: {fees._count}. Booking fees owed: {dollars(fees._sum.feeCents ?? 0)}.</p>
          </div>
          <div className="card flex flex-col gap-3">
            <h2 className="font-semibold text-lg">Patient reviews {rating.count > 0 && <span className="text-muted font-normal">· {rating.average} of 5 from {rating.count}</span>}</h2>
            <p className="text-sm text-muted">Only patients who booked here and completed a visit can review you. Every review is shown, good or bad, and patients can edit or delete theirs. You can reply once in public. Never confirm that the person was your patient or mention their care in a reply.</p>
            {reviews.length === 0 && <p className="text-muted">No reviews yet.</p>}
            {reviews.map((r) => (
              <div key={r.id} className="border-t border-line pt-3 flex flex-col gap-2">
                <span className="font-semibold" aria-label={`${r.rating} of 5 stars`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} <span className="text-sm text-muted font-normal">{r.createdAt.toLocaleDateString("en-US")}{r.status === "REPORTED" ? " · Reported, waiting for review" : ""}</span></span>
                {r.body && <p className="text-ink-2 whitespace-pre-wrap">{r.body}</p>}
                {r.reply ? <p className="text-sm bg-brand-soft rounded-xl p-3"><strong>Your reply:</strong> {r.reply}</p> : (
                  <form action={replyToReview} className="flex flex-wrap gap-2 items-end">
                    <input type="hidden" name="reviewId" value={r.id} />
                    <label className="label flex-1 min-w-60">Public reply<input name="reply" className="field" maxLength={1000} required placeholder="Thank you for the feedback. Please call the office so we can help." /></label>
                    <button className="btn-soft text-sm">Reply</button>
                  </form>
                )}
                {r.status === "SHOWN" && (
                  <form action={reportReview} className="flex flex-wrap gap-2 items-center text-sm">
                    <input type="hidden" name="reviewId" value={r.id} />
                    <select name="reason" className="field !py-1.5 text-sm" aria-label="Report reason">{REPORT_REASONS.map((x) => <option key={x}>{x}</option>)}</select>
                    <button className="text-sm underline text-muted cursor-pointer">Report to FindYourDoc</button>
                  </form>
                )}
              </div>
            ))}
          </div>
          <div className="card flex flex-col gap-3">
            <h2 className="font-semibold text-lg">Open times</h2>
            <SlotsForm />
            <div className="flex flex-wrap gap-2">
              {open.map((s) => (
                <form key={s.id} action={removeSlot}>
                  <input type="hidden" name="slotId" value={s.id} />
                  <button className="text-sm px-3 py-2 rounded-xl border border-field bg-white cursor-pointer" title="Remove this time">{fmt(s.startsAt)} ✕</button>
                </form>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
