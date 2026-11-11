"use client";

import { useActionState, useState } from "react";
import { rescheduleByPatient } from "../../actions/booking";
import { saveReview } from "../../actions/reviews";

type Slot = { id: string; label: string };

export function Reschedule({ token, slots }: { token: string; slots: Slot[] }) {
  const [state, action, pending] = useActionState(rescheduleByPatient, undefined);
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn-soft" onClick={() => setOpen(true)}>Change the time</button>;
  if (slots.length === 0) return <p className="text-muted">No other open times right now. You can keep this visit or cancel it.</p>;
  return (
    <form action={action} className="card flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="label">Choose a new time
        <select name="slotId" className="field" required>{slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </label>
      <p className="text-sm text-muted">Your current time is kept until the new one is confirmed. Changing is free.</p>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Moving…" : "Move my visit"}</button>
    </form>
  );
}

export function ReviewForm({ token, rating, body }: { token: string; rating?: number; body?: string }) {
  const [state, action, pending] = useActionState(saveReview, undefined);
  const [stars, setStars] = useState(rating ?? 0);
  return (
    <form action={action} className="card flex flex-col gap-3">
      <h2 className="font-semibold text-lg">{rating ? "Your review" : "How was your visit?"}</h2>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={stars} />
      <div className="flex gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)}
            className={`text-3xl leading-none cursor-pointer ${n <= stars ? "text-brand" : "text-line"}`}>★</button>
        ))}
      </div>
      <label className="label">What should other patients know? (optional)
        <textarea name="body" defaultValue={body} rows={4} maxLength={1500} className="field resize-y" placeholder="Wait time, how well things were explained, the office staff…" />
      </label>
      <p className="text-xs text-muted">Every review is published, good or bad, under &quot;Verified patient&quot; with no name. You can edit or delete it at any time. We never change your words and never pay or reward reviews. Leave out personal health details.</p>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-brand">Thank you. Your review is published.</p>}
      <button className="btn" disabled={pending || stars === 0}>{pending ? "Saving…" : rating ? "Update review" : "Publish review"}</button>
    </form>
  );
}
