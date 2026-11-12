"use client";

import { useActionState, useState } from "react";
import { saveBookingProfile, addSlots } from "../actions/booking";
import { STATES } from "@/lib/labels";

type P = { bookable: boolean; bio: string; officeName: string; officeAddress: string; officeCity: string; officeState: string; insurance: string; selfPay: string; visitMinutes: number };

export function ProfileForm({ c }: { c: P }) {
  const [state, action, pending] = useActionState(saveBookingProfile, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex gap-2 items-center font-semibold"><input type="checkbox" name="bookable" defaultChecked={c.bookable} /> Accept bookings from patients</label>
      <label className="label">About you (shown to patients)<textarea name="bio" defaultValue={c.bio} rows={3} className="field" maxLength={600} /></label>
      <label className="label">Office name<input name="officeName" defaultValue={c.officeName} className="field" required /></label>
      <label className="label">Street address<input name="officeAddress" defaultValue={c.officeAddress} className="field" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">City<input name="officeCity" defaultValue={c.officeCity} className="field" required /></label>
        <label className="label">State
          <select name="officeState" defaultValue={c.officeState} className="field">{STATES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
      </div>
      <label className="label">Insurance plans accepted (comma separated)<input name="insurance" defaultValue={c.insurance} className="field" placeholder="Aetna, Blue Cross, Medicare" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Self-pay price ($)<input name="selfPay" defaultValue={c.selfPay} className="field" inputMode="numeric" /></label>
        <label className="label">Visit length (minutes)<input name="visitMinutes" type="number" min={10} max={120} defaultValue={c.visitMinutes} className="field" /></label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state && !state.error && <p role="status" className="text-sm text-brand">Saved.</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

export function SlotsForm() {
  const [state, action, pending] = useActionState(addSlots, undefined);
  const [tz] = useState(() => new Date().getTimezoneOffset());
  return (
    <form action={action} className="flex flex-wrap gap-3 items-end">
      <input type="hidden" name="tzOffset" value={tz} />
      <label className="label">Date<input type="date" name="date" className="field" required /></label>
      <label className="label">From<input type="time" name="start" defaultValue="09:00" className="field" required /></label>
      <label className="label">To<input type="time" name="end" defaultValue="12:00" className="field" required /></label>
      <label className="label">Visit type
        <select name="mode" defaultValue="IN_PERSON" className="field">
          <option value="IN_PERSON">In person</option>
          <option value="VIDEO">Video</option>
        </select>
      </label>
      <button className="btn" disabled={pending}>{pending ? "Adding…" : "Open these times"}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700 w-full">{state.error}</p>}
    </form>
  );
}
