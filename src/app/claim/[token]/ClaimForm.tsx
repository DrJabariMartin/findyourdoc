"use client";

import { useActionState } from "react";
import { claimInvite } from "../../actions/team";
import { PROFESSIONS, STATES } from "@/lib/labels";

type Prefill = Partial<Record<"name" | "profession" | "specialty" | "licenseState" | "licenseNumber", string | null>>;

export default function ClaimForm({ token, email, prefill }: { token: string; email: string; prefill: Prefill }) {
  const [state, action, pending] = useActionState(claimInvite, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="label">Email<input value={email} readOnly className="field bg-[#F4F6F8]" /></label>
      <label className="label">Full name<input name="name" className="field" required defaultValue={prefill.name ?? ""} autoComplete="name" /></label>
      <label className="label">Profession
        <select name="profession" className="field" required defaultValue={prefill.profession ?? "PHYSICIAN"}>
          {Object.entries(PROFESSIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="label">Specialty or practice area<input name="specialty" className="field" required defaultValue={prefill.specialty ?? ""} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">License state
          <select name="licenseState" className="field" required defaultValue={prefill.licenseState && STATES.includes(prefill.licenseState) ? prefill.licenseState : ""}>
            <option value="" disabled>Choose a state</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="label">License number<input name="licenseNumber" className="field" required defaultValue={prefill.licenseNumber ?? ""} /></label>
      </div>
      <label className="label">Password<input name="password" type="password" className="field" required minLength={10} autoComplete="new-password" /></label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Setting up…" : "Create account and start verification"}</button>
    </form>
  );
}
