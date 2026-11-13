"use client";

import { useActionState, useState } from "react";
import { postJob } from "../../actions/jobs";
import { JOB_TYPES, PROFESSIONS, STATES } from "@/lib/labels";

export default function JobForm({ city, state: home }: { city: string; state: string }) {
  const [state, action, pending] = useActionState(postJob, undefined);
  const [type, setType] = useState("LOCUMS");
  const unit = type === "PERMANENT" ? "per year" : "per hour";
  return (
    <form action={action} className="card flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="label">Type
          <select name="type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="label">Profession
          <select name="profession" className="field" defaultValue="PHYSICIAN">
            {Object.entries(PROFESSIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <label className="label">Job title<input name="title" className="field" required placeholder="Orthopedic surgeon, weekend call coverage" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">City<input name="city" className="field" required defaultValue={city} /></label>
        <label className="label">State<select name="state" className="field" required defaultValue={home}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      <label className="label">Description<textarea name="description" rows={4} className="field" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Clinician pay ($ {unit})<input name="payMin" type="number" min="1" step="0.01" className="field" required /></label>
        <label className="label">Up to (optional)<input name="payMax" type="number" min="1" step="0.01" className="field" /></label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Posting…" : "Post role"}</button>
    </form>
  );
}
