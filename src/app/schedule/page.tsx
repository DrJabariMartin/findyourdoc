import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { requireVerifiedClinician } from "@/lib/session";
import { dollars } from "@/lib/fees";
import { makeBookingLink, recordVisit, removeSlot } from "../actions/booking";
import { appUrl } from "@/lib/email";
import { ProfileForm, SlotsForm } from "./Forms";

export const dynamic = "force-dynamic";

export default async function Schedule() {
  const user = await requireVerifiedClinician();
  const c = user.clinician;
  const now = new Date();
  const [open, appts, fees] = await Promise.all([
    db.availabilitySlot.findMany({ where: { clinicianId: c.id, status: "OPEN", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 60 }),
    db.appointment.findMany({ where: { slot: { clinicianId: c.id }, status: "BOOKED" }, include: { slot: true }, orderBy: { slot: { startsAt: "asc" } } }),
    db.appointment.aggregate({ where: { slot: { clinicianId: c.id }, status: "COMPLETED" }, _sum: { feeCents: true }, _count: true }),
  ]);
  const fmt = (d: Date) => fmtSlot(d, c.officeState ?? c.licenseState);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="h1">Patient booking</h1>
        {c.feeWaiver ? (
          <p className="text-ink-2 mt-1">Patients book open times directly. Booking fees are waived for you: {c.feeWaiver}.</p>
        ) : (
          <p className="text-ink-2 mt-1">Patients book open times directly. We charge {dollars(4000)} only when a new patient who found you here completes a visit. No-shows, cancellations, existing patients and patients from your own website are free.</p>
        )}
        <p className="text-sm text-muted mt-1">Video visits: patients choose the state they&apos;ll be in, and we only accept states where you hold a verified license. Send each patient a secure link from your own video tool (one covered by your BAA), check their photo ID and confirm where they are at the start of the visit.</p>
      </div>
      <div className="flex flex-wrap gap-6 items-start">
        <section className="flex-[1_1_340px] card flex flex-col gap-3">
          <h2 className="font-semibold text-lg">Your booking profile</h2>
          <ProfileForm c={{ bookable: c.bookable, bio: c.bio ?? "", officeName: c.officeName ?? "", officeAddress: c.officeAddress ?? "", officeCity: c.officeCity ?? "", officeState: c.officeState ?? c.licenseState, insurance: c.insurance ?? "", selfPay: c.selfPayCents ? String(c.selfPayCents / 100) : "", visitMinutes: c.visitMinutes }} />
        </section>
        <section className="flex-[2_1_420px] flex flex-col gap-6">
          <div className="card flex flex-col gap-3">
            <h2 className="font-semibold text-lg">Upcoming appointments ({appts.length})</h2>
            {appts.length === 0 && <p className="text-muted">None yet.</p>}
            {appts.map((a) => (
              <div key={a.id} className="flex flex-wrap gap-3 items-center justify-between border-t border-line pt-3">
                <div className="flex flex-col">
                  <span className="font-semibold">{fmt(a.slot.startsAt)} · {a.slot.mode === "VIDEO" ? `Video (patient in ${a.patientState}) · ` : ""}{a.patientName}</span>
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
            <h2 className="font-semibold text-lg">Your own booking link</h2>
            <p className="text-sm text-ink-2">Put this link on your website, your link-in-bio page, your emails and a QR code at the front desk. Patients who book through it are your own patients, so there is never a booking fee for them.</p>
            {c.bookingCode ? (
              <>
                <input readOnly className="field font-mono text-sm" value={appUrl(`/b/${c.bookingCode}`)} aria-label="Your booking link" />
                <label className="label">Button for your website (paste into your page&apos;s HTML)
                  <textarea readOnly rows={3} className="field font-mono text-xs" value={`<a href="${appUrl(`/b/${c.bookingCode}`)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#0B6E69;color:#fff;font-weight:600;text-decoration:none">Book online</a>`} />
                </label>
                <div className="flex flex-wrap gap-2"><a href="/schedule/qr" className="btn !py-2 !px-3 text-sm">Print a QR code</a><form action={makeBookingLink}><button className="btn-soft text-sm">Make a new link (the old one stops working)</button></form></div>
              </>
            ) : (
              <form action={makeBookingLink}><button className="btn !py-2 !px-3 text-sm">Create my booking link</button></form>
            )}
          </div>
          <div className="card flex flex-col gap-3">
            <h2 className="font-semibold text-lg">Open times</h2>
            <SlotsForm />
            <div className="flex flex-wrap gap-2">
              {open.map((s) => (
                <form key={s.id} action={removeSlot}>
                  <input type="hidden" name="slotId" value={s.id} />
                  <button className="text-sm px-3 py-2 rounded-xl border border-field bg-white cursor-pointer" title="Remove this time">{fmt(s.startsAt)}{s.mode === "VIDEO" ? " · Video" : ""} ✕</button>
                </form>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
