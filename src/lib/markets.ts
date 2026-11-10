// Launch markets and the per-state gate on locums.
//
// Primary market: DC, Maryland and Virginia. Atlanta (Georgia) is an optional second market.
// Community, permanent hiring and booking work in every state. Locums is different:
// Maryland and DC license agencies that place clinicians for temporary work, so a
// locums post is only allowed where LOCUMS_STATES says we are cleared. See docs/launch.md.

export const PRIMARY_MARKET = ["DC", "MD", "VA"] as const;
export const SECOND_MARKET = ["GA"] as const;

/** States where locums posts are allowed. Unset means no gate (local development). */
export function locumsStates(env: string | undefined = process.env.LOCUMS_STATES): string[] | null {
  if (env === undefined) return null;
  return env.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

export function locumsAllowed(state: string, env: string | undefined = process.env.LOCUMS_STATES): boolean {
  const allowed = locumsStates(env);
  return allowed === null || allowed.includes(state.toUpperCase());
}
