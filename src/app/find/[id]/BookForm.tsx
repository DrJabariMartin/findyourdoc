"use client";

import { useActionState, useState } from "react";
import { bookSlot } from "../../actions/booking";

type Slot = { id: string; day: string; time: string };

export default function BookForm({ slots, initial }: { slots: Slot[]; initial?: string }) {
  const [pick, setPick] = useState(slots.some((s) => s.id === initial) ? initial : undefined);
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
                {s.time}
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
          <label className="label">Insurance plan (leave blank for self-pay)<input name="insurance" className="field" /></label>
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
