"use client";

import { useActionState, useState } from "react";
import { joinWaitlist } from "../actions/waitlist";
import { STATES } from "@/lib/labels";

const ROLES = [
  ["PATIENT", "I'm looking for care"],
  ["CLINICIAN", "I'm a clinician"],
  ["PRACTICE", "I'm hiring for a practice"],
] as const;

type Tags = { utm_source: string; utm_campaign: string; utm_content: string };

export default function WaitlistForm({ initialRole, depositsLive, tags }: { initialRole: string; depositsLive: boolean; tags: Tags }) {
  const [role, setRole] = useState(ROLES.some(([r]) => r === initialRole) ? initialRole : "PATIENT");
  const [state, action, pending] = useActionState(joinWaitlist, undefined);
  if (state?.done) {
    return (
      <div role="status" className="card text-brand-dark bg-brand-soft! flex flex-col gap-3">
        <p>
          {role === "PRACTICE"
            ? "You're on the list. We've just emailed you the empty provider slot calculator, and we'll email you when we open in your state."
            : "You're on the list. We'll email you once, when we open in your state. Nothing else."}
        </p>
        {state.depositUrl && (
          <>
            <p>To hold your founding-practice spot, pay the refundable $99 deposit. It comes off your first paid month, and we refund it in full whenever you ask.</p>
            <a href={state.depositUrl} className="btn self-start" rel="noopener noreferrer">Pay the $99 deposit</a>
          </>
        )}
      </div>
    );
  }
  return (
    <form action={action} className="card flex flex-col gap-4">
      {role !== "PATIENT" &&
        (Object.entries(tags) as [keyof Tags, string][]).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold mb-1">Who are you?</legend>
        {ROLES.map(([r, label]) => (
          <label key={r} className="flex items-center gap-2">
            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} /> {label}
          </label>
        ))}
      </fieldset>
      <label className="label">Email<input name="email" type="email" className="field" required autoComplete="email" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">State
          <select name="state" className="field" required defaultValue="">
            <option value="" disabled>Choose a state</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="label">City (optional)<input name="city" className="field" autoComplete="address-level2" /></label>
      </div>
      {role === "PRACTICE" && (
        <>
          <label className="label">Phone (optional)<input name="phone" type="tel" className="field" autoComplete="tel" /></label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="contactConsent" value="yes" className="mt-1" />
            <span>FindYourDoc may call or text me about hiring at this number. Message and data rates may apply. Reply STOP to opt out. This is optional.</span>
          </label>
        </>
      )}
      {role === "PRACTICE" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="depositIntent" value="yes" className="mt-1" />
          <span>
            {depositsLive
              ? "Hold a founding-practice spot in my state with a refundable $99 deposit. It comes off the first paid month, and you can get it back in full at any time."
              : "I would put down a refundable $99 deposit to hold a founding-practice spot in my state. (We don't take any money now. This only tells us how serious demand is.)"}
          </span>
        </label>
      )}
      <p className="text-sm text-muted">Please don&apos;t include any health details. We use your email only to tell you when we open (practices also get the calculator).</p>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Joining…" : "Join the waitlist"}</button>
    </form>
  );
}
