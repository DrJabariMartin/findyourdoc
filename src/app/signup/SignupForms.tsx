"use client";

import { useActionState, useRef, useState } from "react";
import { prefillFromNpi, signupClinician, signupPractice } from "../actions/auth";
import Link from "next/link";
import { PROFESSIONS, STATES } from "@/lib/labels";
import { PLANS, dollars } from "@/lib/fees";

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

/** NPI first: one lookup fills name, profession, specialty and license from the public registry. */
function NpiPrefill({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const [npi, setNpi] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  async function fill() {
    setBusy(true);
    setNote(null);
    const r = await prefillFromNpi(npi);
    setBusy(false);
    if (!r.ok) return setNote({ ok: false, text: r.error });
    const f = formRef.current;
    const set = (name: string, v: string | null) => {
      const el = f?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (el && v && !el.value) el.value = v;
    };
    const setAlways = (name: string, v: string | null) => {
      const el = f?.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      if (el && v) el.value = v;
    };
    set("name", r.name);
    setAlways("profession", r.profession);
    set("specialty", r.specialty);
    setAlways("licenseState", r.licenseState);
    set("licenseNumber", r.licenseNumber);
    setNote({ ok: true, text: "Filled from the national registry. Please check each field before you continue." });
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="label">NPI (optional, fills the form and speeds up verification)
        <div className="flex gap-2">
          <input name="npi" className="field flex-1" inputMode="numeric" pattern="\d{10}" maxLength={10} value={npi} onChange={(e) => setNpi(e.target.value.replace(/\D/g, ""))} />
          <button type="button" className="btn-soft" disabled={busy || npi.length !== 10} onClick={fill}>{busy ? "Looking up…" : "Fill from registry"}</button>
        </div>
      </label>
      {note && <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "text-muted" : "text-red-700"}`}>{note.text}</p>}
    </div>
  );
}

export default function SignupForms({ initial, plan }: { initial: "clinician" | "practice"; plan?: string }) {
  const [tab, setTab] = useState(initial);
  const [cState, cAction, cPending] = useActionState(signupClinician, undefined);
  const [pState, pAction, pPending] = useActionState(signupPractice, undefined);
  const cForm = useRef<HTMLFormElement>(null);
  const tabClass = (on: boolean) =>
    `px-4 py-2.5 rounded-full border font-semibold text-sm cursor-pointer ${on ? "bg-brand text-white border-brand" : "bg-white border-field"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2" role="group" aria-label="Account type">
        <button type="button" aria-pressed={tab === "clinician"} className={tabClass(tab === "clinician")} onClick={() => setTab("clinician")}>I&apos;m a clinician</button>
        <button type="button" aria-pressed={tab === "practice"} className={tabClass(tab === "practice")} onClick={() => setTab("practice")}>I&apos;m hiring</button>
      </div>

      {tab === "clinician" ? (
        <form action={cAction} ref={cForm} className="card flex flex-col gap-4">
          <NpiPrefill formRef={cForm} />
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
          <label className="label">Plan
            <select name="plan" className="field" defaultValue={PLANS.some((p) => p.id === plan) ? plan : "SOLO"}>
              {PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}, {dollars(p.monthlyCents)} a month</option>)}
            </select>
          </label>
          <p className="text-sm text-muted">Compare plans and guarantees on the <Link href="/pricing" className="underline">pricing page</Link>. Hire and locums fees are the same on every plan.</p>
          {pState?.error && <p role="alert" className="text-sm text-red-700">{pState.error}</p>}
          <button className="btn" disabled={pPending}>{pPending ? "Creating account…" : "Create practice account"}</button>
        </form>
      )}
    </div>
  );
}
