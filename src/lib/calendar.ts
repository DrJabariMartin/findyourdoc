// Calendar sync for Google Calendar and Microsoft 365 (Outlook).
//
// What we read: busy time ranges only (Google free/busy; Microsoft
// calendarView with Calendars.ReadBasic, selecting start, end and showAs).
// What we never read: event titles, attendees, locations or bodies.
// What we write: nothing.
//
// Switched on per provider by setting its app keys (see .env.example).
// Until then the schedule page says calendar sync isn't set up yet.

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type Provider = "GOOGLE" | "MICROSOFT";
export const PROVIDERS: Provider[] = ["GOOGLE", "MICROSOFT"];
export const PROVIDER_LABELS: Record<Provider, string> = { GOOGLE: "Google Calendar", MICROSOFT: "Outlook / Microsoft 365" };
export const SYNC_DAYS = 60;

export type Busy = { start: Date; end: Date };

type Env = Record<string, string | undefined>;

const CONFIG = {
  GOOGLE: {
    id: "GOOGLE_CLIENT_ID",
    secret: "GOOGLE_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/calendar.freebusy",
  },
  MICROSOFT: {
    id: "MICROSOFT_CLIENT_ID",
    secret: "MICROSOFT_CLIENT_SECRET",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: "offline_access https://graph.microsoft.com/Calendars.ReadBasic",
  },
} as const;

/** A provider is on only when its app keys and the token key are all set. */
export function calendarEnabled(p: Provider, env: Env = process.env): boolean {
  const c = CONFIG[p];
  return !!(env[c.id] && env[c.secret] && tokenKey(env));
}

export function parseProvider(s: string): Provider | null {
  const up = s.toUpperCase();
  return up === "GOOGLE" || up === "MICROSOFT" ? up : null;
}

export function redirectUri(p: Provider, appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/calendar/${p.toLowerCase()}/callback`;
}

export function authorizeUrl(p: Provider, appUrl: string, state: string, env: Env = process.env): string {
  const c = CONFIG[p];
  const q = new URLSearchParams({
    client_id: env[c.id] ?? "",
    redirect_uri: redirectUri(p, appUrl),
    response_type: "code",
    scope: c.scope,
    state,
  });
  // Google returns a refresh token only with offline access and consent.
  if (p === "GOOGLE") {
    q.set("access_type", "offline");
    q.set("prompt", "consent");
  }
  return `${c.authUrl}?${q}`;
}

// ---------------------------------------------------------------------------
// State parameter: binds the OAuth round trip to the signed-in clinician.
// ---------------------------------------------------------------------------

function stateSecret(env: Env) {
  const s = env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is missing");
  return s;
}

export function signState(clinicianId: string, now = Date.now(), env: Env = process.env): string {
  const body = `${clinicianId}.${now}.${randomBytes(8).toString("hex")}`;
  const mac = createHmac("sha256", stateSecret(env)).update(body).digest("base64url");
  return `${Buffer.from(body).toString("base64url")}.${mac}`;
}

/** Returns the clinician id if the state is ours and under 15 minutes old. */
export function readState(state: string, now = Date.now(), env: Env = process.env): string | null {
  const [b, mac] = state.split(".");
  if (!b || !mac) return null;
  const body = Buffer.from(b, "base64url").toString();
  const want = createHmac("sha256", stateSecret(env)).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const [id, ts] = body.split(".");
  if (!id || !ts || now - Number(ts) > 15 * 60_000 || Number(ts) > now + 60_000) return null;
  return id;
}

// ---------------------------------------------------------------------------
// Refresh tokens are stored encrypted (AES-256-GCM).
// ---------------------------------------------------------------------------

function tokenKey(env: Env): Buffer | null {
  const k = env.CALENDAR_TOKEN_KEY;
  if (!k) return null;
  const buf = Buffer.from(k, "base64");
  return buf.length === 32 ? buf : null;
}

export function encryptToken(plain: string, env: Env = process.env): string {
  const key = tokenKey(env);
  if (!key) throw new Error("CALENDAR_TOKEN_KEY must be 32 bytes, base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(sealed: string, env: Env = process.env): string {
  const key = tokenKey(env);
  if (!key) throw new Error("CALENDAR_TOKEN_KEY must be 32 bytes, base64");
  const [iv, tag, enc] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ---------------------------------------------------------------------------
// Provider calls.
// ---------------------------------------------------------------------------

type Fetch = typeof fetch;

async function tokenRequest(p: Provider, params: Record<string, string>, env: Env, f: Fetch) {
  const c = CONFIG[p];
  const res = await f(c.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env[c.id] ?? "", client_secret: env[c.secret] ?? "", ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`token request failed: ${data.error ?? res.status}`);
  return data as { access_token: string; refresh_token?: string };
}

/** Swaps the sign-in code for tokens. Returns the refresh token we keep. */
export async function exchangeCode(p: Provider, code: string, appUrl: string, env: Env = process.env, f: Fetch = fetch): Promise<string> {
  const t = await tokenRequest(p, { grant_type: "authorization_code", code, redirect_uri: redirectUri(p, appUrl) }, env, f);
  if (!t.refresh_token) throw new Error("the calendar didn't grant offline access");
  return t.refresh_token;
}

/** A fresh access token, plus a new refresh token when the provider rotates it. */
export async function refreshAccess(p: Provider, refreshToken: string, env: Env = process.env, f: Fetch = fetch) {
  const t = await tokenRequest(p, { grant_type: "refresh_token", refresh_token: refreshToken }, env, f);
  return { accessToken: t.access_token, rotated: t.refresh_token && t.refresh_token !== refreshToken ? t.refresh_token : null };
}

export function parseGoogleBusy(data: unknown): Busy[] {
  const cal = (data as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> })?.calendars?.primary;
  return (cal?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })).filter(validBusy);
}

/** Microsoft events: free and working-elsewhere don't block; tentative, busy and out of office do. */
export function parseMicrosoftBusy(data: unknown): Busy[] {
  const items = (data as { value?: { showAs?: string; start?: { dateTime: string }; end?: { dateTime: string } }[] })?.value ?? [];
  return items
    .filter((e) => e.showAs !== "free" && e.showAs !== "workingElsewhere" && e.start && e.end)
    // Times come back in UTC because we ask for it (Prefer header), without a "Z".
    .map((e) => ({ start: new Date(asUtc(e.start!.dateTime)), end: new Date(asUtc(e.end!.dateTime)) }))
    .filter(validBusy);
}

const asUtc = (s: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
const validBusy = (b: Busy) => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime()) && b.end > b.start;

export async function fetchBusy(p: Provider, accessToken: string, from: Date, to: Date, f: Fetch = fetch): Promise<Busy[]> {
  const auth = { Authorization: `Bearer ${accessToken}` };
  if (p === "GOOGLE") {
    const res = await f("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: "primary" }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Google free/busy returned HTTP ${res.status}`);
    return parseGoogleBusy(await res.json());
  }
  const busy: Busy[] = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${from.toISOString()}&endDateTime=${to.toISOString()}&$select=start,end,showAs&$top=200`;
  for (let page = 0; url && page < 10; page++) {
    const res: Response = await f(url, { headers: { ...auth, Prefer: 'outlook.timezone="UTC"' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Microsoft calendar returned HTTP ${res.status}`);
    const data: { "@odata.nextLink"?: string } = await res.json();
    busy.push(...parseMicrosoftBusy(data));
    url = data["@odata.nextLink"] ?? null;
  }
  return busy;
}

// ---------------------------------------------------------------------------
// Applying busy times to open slots.
// ---------------------------------------------------------------------------

type SlotLike = { id: string; startsAt: Date; minutes: number; status: string };

export function clashes(slot: { startsAt: Date; minutes: number }, busy: Busy[]): boolean {
  const s = slot.startsAt.getTime();
  const e = s + slot.minutes * 60_000;
  return busy.some((b) => b.start.getTime() < e && b.end.getTime() > s);
}

/**
 * Which slots to hide and which to bring back. Only OPEN and BUSY slots are
 * ever touched: a booked visit is never moved by a calendar change.
 */
export function planSlotChanges(slots: SlotLike[], busy: Busy[]): { hide: string[]; reopen: string[] } {
  const hide: string[] = [];
  const reopen: string[] = [];
  for (const s of slots) {
    const clash = clashes(s, busy);
    if (s.status === "OPEN" && clash) hide.push(s.id);
    else if (s.status === "BUSY" && !clash) reopen.push(s.id);
  }
  return { hide, reopen };
}
