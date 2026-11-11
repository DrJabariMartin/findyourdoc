"use client";

import { useActionState } from "react";
import { sendMessage } from "../../actions/jobs";

export default function MessageForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(sendMessage, undefined);
  return (
    <form action={action} className="flex flex-col gap-2" key={state?.ok ? Math.random() : "msg"}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <label className="label">Message<textarea name="body" rows={3} required maxLength={4000} className="field resize-y" placeholder="Suggest interview times, ask a question…" /></label>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn self-start" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
      <p className="text-xs text-muted">Don&apos;t share patient information here.</p>
    </form>
  );
}
