"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "../actions/auth";

export default function Forgot() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <div className="max-w-md flex flex-col gap-6">
      <h1 className="h1">Reset your password</h1>
      {state?.sent ? (
        <p className="card">If an account uses that email, a reset link is on its way. It works for 1 hour.</p>
      ) : (
        <form action={action} className="card flex flex-col gap-4">
          <label className="label">Email<input name="email" type="email" className="field" required autoComplete="email" /></label>
          {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          <button className="btn" disabled={pending}>{pending ? "Sending…" : "Email me a reset link"}</button>
        </form>
      )}
    </div>
  );
}
