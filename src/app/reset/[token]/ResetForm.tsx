"use client";

import { useActionState } from "react";
import { resetPassword } from "../../actions/auth";

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="label">New password<input name="password" type="password" className="field" required minLength={10} autoComplete="new-password" /></label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
