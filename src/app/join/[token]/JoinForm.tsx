"use client";

import { useActionState } from "react";
import { acceptInvite } from "../../actions/team";

export default function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="label">Full name<input name="name" className="field" required autoComplete="name" /></label>
      <label className="label">Password<input name="password" type="password" className="field" required minLength={10} autoComplete="new-password" /></label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Setting up…" : "Join the team"}</button>
    </form>
  );
}
