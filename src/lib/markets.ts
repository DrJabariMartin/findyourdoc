// Per-state gate on locums posts.
//
// Community, permanent hiring and per-diem posts work in every state. Locums is different:
// Maryland and DC license agencies that place clinicians for temporary work, so a
// locums post is only allowed where LOCUMS_STATES says we are cleared. See docs/launch.md.

/** Unset means no gate (local development). Set but empty means locums is closed everywhere. */
export function locumsAllowed(state: string, env: string | undefined = process.env.LOCUMS_STATES): boolean {
  if (env === undefined) return true;
  return env.toUpperCase().split(",").map((s) => s.trim()).includes(state.toUpperCase());
}
