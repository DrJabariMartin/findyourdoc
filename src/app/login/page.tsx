"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "../actions/auth";

export default function Login() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="max-w-md flex flex-col gap-6">
      <h1 className="h1">Log in</h1>
      <form action={action} className="card flex flex-col gap-4">
        <label className="label">Email<input name="email" type="email" className="field" required autoComplete="email" /></label>
        <label className="label">Password<input name="password" type="password" className="field" required autoComplete="current-password" /></label>
        {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        <button className="btn" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="text-sm"><Link href="/forgot" className="text-brand underline">Forgot your password?</Link></p>
      <p className="text-sm">New here? <Link href="/signup" className="text-brand underline">Join free</Link></p>
    </div>
  );
}
