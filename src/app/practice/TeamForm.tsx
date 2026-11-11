"use client";

import { useActionState } from "react";
import { inviteClinician, inviteTeammate } from "../actions/team";

export default function TeamForm() {
  const [state, action, pending] = useActionState(inviteTeammate, undefined);
  return (
    <form action={action} className="flex flex-wrap gap-2 items-end" key={state?.ok ?? "invite"}>
      <label className="label flex-1 min-w-60">Invite by work email<input name="email" type="email" className="field" required /></label>
      <button className="btn-soft" disabled={pending}>{pending ? "Sending…" : "Send invite"}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700 w-full">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-brand w-full">{state.ok}</p>}
    </form>
  );
}

/** Invite the practice's own clinicians; the NPI pre-fills their sign-up. */
export function ClinicianInviteForm() {
  const [state, action, pending] = useActionState(inviteClinician, undefined);
  return (
    <form action={action} className="flex flex-wrap gap-2 items-end" key={state?.ok ?? "cinvite"}>
      <label className="label flex-1 min-w-52">Clinician&apos;s email<input name="email" type="email" className="field" required /></label>
      <label className="label w-40">NPI (optional)<input name="npi" className="field" inputMode="numeric" pattern="\d{10}" maxLength={10} /></label>
      <button className="btn-soft" disabled={pending}>{pending ? "Sending…" : "Invite clinician"}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700 w-full">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-brand w-full">{state.ok}</p>}
    </form>
  );
}
