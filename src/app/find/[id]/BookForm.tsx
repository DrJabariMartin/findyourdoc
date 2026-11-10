"use client";

import { useActionState, useState } from "react";
import { bookSlot } from "../../actions/booking";

type Slot = { id: string; day: string; time: string; mode: string };

export default function BookForm({ slots, initial, videoStates, office }: { slots: Slot[]; initial?: string; videoStates: string[]; office: string }) {
  const [pick, setPick] = useState(slots.some((s) => s.id === initial) ? initial : undefined);
  const video = slots.find((s) => s.id === pick)?.mode === "VIDEO";
  const [state, action, pending] = useActionState(bookSlot, undefined);
  const days = [...new Set(slots.map((s) => s.day))];
  return (
    <form action={action} className="flex flex-col gap-4">
      {days.map((d) => (
        <div key={d} className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted">{d}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={d}>
            {slots.filter((s) => s.day === d).map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={pick === s.id} onClick={() => setPick(s.id)}
                className={`text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-brand cursor-pointer ${pick === s.id ? "bg-brand text-white" : "bg-white text-brand"}`}>
                {s.time}{s.mode === "VIDEO" ? " · Video" : ""}
              </button>
            ))}
          </div>
        </div>
      ))}
      {pick && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <input type="hidden" name="slotId" value={pick} />
          <label className="label">Full name<input name="patientName" className="field" required autoComplete="name" /></label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="label">Email<input name="patientEmail" type="email" className="field" required autoComplete="email" /></label>
            <label className="label">Mobile phone<input name="patientPhone" type="tel" className="field" required autoComplete="tel" /></label>
          </div>
          {video && (
            <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <p className="text-sm font-semibold">This is a video visit</p>
              <label className="label">Where will you be during the visit?
                <select name="patientState" className="field" required defaultValue="">
                  <option value="" disabled>Choose a state</option>
                  {videoStates.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <p className="text-xs text-muted">Clinicians can only see you by video while you are in a state where they are licensed. If you&apos;ll be somewhere else, choose an in-person time instead.</p>
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" name="telehealthConsent" className="mt-1" required />
                I agree to a video visit. {office} will send me a secure link, check my photo ID, confirm where I am, and ask who else is in the room. If the video drops, they&apos;ll call the phone number above. A video visit isn&apos;t for emergencies: call 911.</label>
            </div>
          )}
          <label className="label">Insurance plan (leave blank for self-pay)<input name="insurance" className="field" /></label>
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" name="governmentPlan" className="mt-1" /> My plan is Medicare, Medicare Advantage, Medicaid (such as HealthChoice, Cardinal Care or DC Healthy Families), TRICARE or VA</label>
          <label className="label">Reason for visit (optional, keep it brief)<input name="reason" className="field" maxLength={300} /></label>
          <fieldset className="flex gap-4 text-sm">
            <legend className="font-semibold mb-1">Have you seen this clinician before?</legend>
            <label className="flex gap-2 items-center"><input type="radio" name="newPatient" value="yes" defaultChecked /> No, I&apos;m new</label>
            <label className="flex gap-2 items-center"><input type="radio" name="newPatient" value="no" /> Yes</label>
          </fieldset>
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" name="consent" className="mt-1" required />
            I agree that my details are shared only with this clinician&apos;s office to arrange my visit. FindYourDoc does not sell patient data.</label>
          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          <button className="btn" disabled={pending}>{pending ? "Booking…" : "Book this time"}</button>
          <p className="text-xs text-muted">For an emergency, call 911. Booking is free for patients.</p>
        </div>
      )}
    </form>
  );
}
