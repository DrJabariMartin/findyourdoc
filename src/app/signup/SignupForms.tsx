"use client";

import { useActionState, useState } from "react";
import { signupClinician, signupPractice } from "../actions/auth";
import { PROFESSIONS, STATES } from "@/lib/labels";

function StateSelect({ name }: { name: string }) {
  return (
    <select name={name} className="field" required defaultValue="">
      <option value="" disabled>Choose a state</option>
      {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function Account() {
  return (
    <>
      <label className="label">Full name<input name="name" className="field" required autoComplete="name" /></label>
      <label className="label">Email<input name="email" type="email" className="field" required autoComplete="email" /></label>
      <label className="label">Password<input name="password" type="password" className="field" required minLength={10} autoComplete="new-password" /></label>
    </>
  );
}

export default function SignupForms({ initial }: { initial: "clinician" | "practice" }) {
  const [tab, setTab] = useState(initial);
  const [cState, cAction, cPending] = useActionState(signupClinician, undefined);
  const [pState, pAction, pPending] = useActionState(signupPractice, undefined);
  const tabClass = (on: boolean) =>
    `px-4 py-2.5 rounded-full border font-semibold text-sm cursor-pointer ${on ? "bg-brand text-white border-brand" : "bg-white border-field"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2" role="group" aria-label="Account type">
        <button type="button" aria-pressed={tab === "clinician"} className={tabClass(tab === "clinician")} onClick={() => setTab("clinician")}>I&apos;m a clinician</button>
        <button type="button" aria-pressed={tab === "practice"} className={tabClass(tab === "practice")} onClick={() => setTab("practice")}>I&apos;m hiring</button>
      </div>

      {tab === "clinician" ? (
        <form action={cAction} className="card flex flex-col gap-4">
          <Account />
          <label className="label">Profession
            <select name="profession" className="field" required defaultValue="PHYSICIAN">
              {Object.entries(PROFESSIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="label">Specialty or practice area<input name="specialty" className="field" required placeholder="Orthopedic surgeon" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">License state<StateSelect name="licenseState" /></label>
            <label className="label">License number<input name="licenseNumber" className="field" required /></label>
          </div>
          <label className="label">NPI (optional, speeds up verification)<input name="npi" className="field" inputMode="numeric" pattern="\d{10}" /></label>
          <p className="text-sm text-muted">Practices never see your Lounge posts. Anonymous posts show only your role and region.</p>
          {cState?.error && <p role="alert" className="text-sm text-red-700">{cState.error}</p>}
          <button className="btn" disabled={cPending}>{cPending ? "Creating account…" : "Create account and start verification"}</button>
        </form>
      ) : (
        <form action={pAction} className="card flex flex-col gap-4">
          <Account />
          <label className="label">Practice name<input name="practiceName" className="field" required /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">City<input name="city" className="field" required /></label>
            <label className="label">State<StateSelect name="state" /></label>
          </div>
          {pState?.error && <p role="alert" className="text-sm text-red-700">{pState.error}</p>}
          <button className="btn" disabled={pPending}>{pPending ? "Creating account…" : "Create practice account"}</button>
        </form>
      )}
    </div>
  );
}
