// A simple fixed-window rate limiter kept in memory. It protects sign-up,
// login, password reset and booking from scripted abuse on a single server.
// With more than one server, move the counters to Redis or the database.

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export const LIMITS = {
  login: { max: 10, windowMs: 15 * 60_000 },
  signup: { max: 5, windowMs: 60 * 60_000 },
  reset: { max: 5, windowMs: 60 * 60_000 },
  booking: { max: 10, windowMs: 60 * 60_000 },
  upload: { max: 30, windowMs: 60 * 60_000 },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Returns true if the action is allowed, and counts it. */
export function hit(name: LimitName, key: string, now = Date.now()): boolean {
  const { max, windowMs } = LIMITS[name];
  const id = `${name}:${key}`;
  const w = windows.get(id);
  if (!w || w.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + windowMs });
    if (windows.size > 50_000) for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    return true;
  }
  if (w.count >= max) return false;
  w.count++;
  return true;
}

export function resetLimits() {
  windows.clear();
}
