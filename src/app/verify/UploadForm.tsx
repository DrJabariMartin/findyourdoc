"use client";

import { useActionState } from "react";
import { uploadCredential } from "../actions/verify";

export function UploadForm({ options }: { options: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(uploadCredential, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Upload a document</h2>
      <label className="label">Credential
        <select name="credentialId" className="field" required>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <label className="label">File (PDF, JPG or PNG, up to 10 MB)
        <input name="file" type="file" accept="application/pdf,image/jpeg,image/png" className="field" required />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-brand">{state.ok}</p>}
      <button className="btn" disabled={pending}>{pending ? "Uploading…" : "Upload securely"}</button>
      <p className="text-sm text-muted">Only you and our verification team can open your documents. Practices never see them unless you share your packet.</p>
    </form>
  );
}
