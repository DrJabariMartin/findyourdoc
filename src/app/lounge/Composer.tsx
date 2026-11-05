"use client";

import { useActionState, useState } from "react";
import { createPost } from "../actions/lounge";

export default function Composer({ roomId, anonAs, namedAs }: { roomId: string; anonAs: string; namedAs: string }) {
  const [anon, setAnon] = useState(true);
  const [state, action, pending] = useActionState(createPost, undefined);
  return (
    <form action={action} className="card flex flex-col gap-3" key={state?.ok ? Math.random() : "form"}>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="anonymous" value={anon ? "on" : "off"} />
      <label className="label">Title<input name="title" className="field" required maxLength={160} /></label>
      <label className="label">Start a discussion
        <textarea name="body" rows={3} required className="field resize-y" placeholder="Ask a question or share a case. Identifying details are checked before posting." />
      </label>
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 items-center">
          <button type="button" aria-pressed={anon} onClick={() => setAnon(!anon)}
            className={`text-sm font-semibold px-3.5 py-2.5 rounded-full border cursor-pointer ${anon ? "border-brand bg-brand-soft text-brand-dark" : "border-field bg-white"}`}>
            {anon ? "Anonymous: on" : "Anonymous: off"}
          </button>
          <span className="text-sm text-muted">Posting as <strong className="text-ink">{anon ? anonAs : namedAs}</strong></span>
        </div>
        <button className="btn" disabled={pending}>{pending ? "Posting…" : "Post"}</button>
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.held && <p role="status" className="text-sm text-warn">Your post looks like it may include a {state.held.join(", ")}. A moderator will review it before it appears.</p>}
    </form>
  );
}
