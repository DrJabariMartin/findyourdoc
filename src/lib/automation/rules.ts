// Pure rules behind FindYourDoc's automations. No database or network here,
// so every decision the automations make can be unit-tested.

import type { NpiResult } from "../npi";

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const RECHECK_DAYS = 90;

// ---------------------------------------------------------------------------
// Registry check. Advises the admin; never approves anyone by itself.
// ---------------------------------------------------------------------------

export type CheckResult = "MATCH" | "MISMATCH" | "NOT_FOUND" | "NO_NPI";

export type ProfileForCheck = {
  name: string;
  profession: string;
  licenseState: string;
  licenseNumber: string;
  npi: string | null;
};

// What a profession's NPPES credential or taxonomy usually contains.
const PROFESSION_SIGNS: Record<string, RegExp> = {
  PHYSICIAN: /\b(M\.?\s?D|D\.?\s?O)\b|physician|surgery|medicine|pediatrics|psychiatry|radiology|anesthesiology|dermatology|neurology|pathology|ophthalmology|urology|obstetrics/i,
  NP: /\b(N\.?P|APRN|FNP|ACNP|DNP)\b|nurse practitioner/i,
  PA: /\b(P\.?A|PA-C)\b|physician assistant/i,
  NURSE: /\b(R\.?N|LPN|LVN|BSN|MSN)\b|registered nurse|nurse/i,
  CRNA: /\bCRNA\b|nurse anesthetist/i,
  PT: /\b(P\.?T|DPT)\b|physical therap/i,
  OT: /\b(O\.?T|OTR|OTD)\b|occupational therap/i,
  PHARMACIST: /\b(PharmD|R\.?Ph)\b|pharmacist/i,
};

/** Best guess at a profession from an NPPES credential and taxonomy, for prefilling sign-up. */
export function guessProfession(credential: string | null, taxonomy: string | null): string | null {
  const text = `${credential ?? ""} ${taxonomy ?? ""}`;
  // Most specific first: "nurse anesthetist" also says "nurse".
  for (const p of ["CRNA", "NP", "PA", "PT", "OT", "PHARMACIST", "NURSE", "PHYSICIAN"]) if (PROFESSION_SIGNS[p].test(text)) return p;
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Boards print the same license as "ME 012345", "ME12345" or "12345", so
// compare the digits without leading zeros when there are any.
const normLicense = (s: string) => {
  const digits = s.replace(/\D/g, "").replace(/^0+/, "");
  return digits || norm(s);
};

function nameTokens(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(dr|md|do|np|pa|rn|jr|sr|ii|iii)\b\.?/g, " ")
    .split(/[^a-z'-]+/)
    .filter((t) => t.length > 1);
}

/** True when the last name matches and the first initial agrees. */
export function namesAgree(claimed: string, registry: string): boolean {
  const a = nameTokens(claimed);
  const b = nameTokens(registry);
  if (a.length === 0 || b.length === 0) return false;
  const lastA = a[a.length - 1];
  const lastB = b[b.length - 1];
  return lastA === lastB && a[0][0] === b[0][0];
}

export function compareWithRegistry(
  profile: ProfileForCheck,
  registry: NpiResult | null,
): { result: CheckResult; issues: string[] } {
  if (!profile.npi) return { result: "NO_NPI", issues: ["No NPI given: check the state board and ID by hand"] };
  if (!registry) return { result: "NOT_FOUND", issues: [`NPI ${profile.npi} was not found in NPPES or is deactivated`] };

  const issues: string[] = [];
  if (!namesAgree(profile.name, registry.name))
    issues.push(`Name on account "${profile.name}" does not match the registry name "${registry.name}"`);

  const signs = PROFESSION_SIGNS[profile.profession];
  const registryText = `${registry.credential ?? ""} ${registry.taxonomy ?? ""}`;
  if (signs && registryText.trim() && !signs.test(registryText))
    issues.push(`Profession "${profile.profession}" does not fit the registry entry "${registryText.trim()}"`);

  if (registry.state && registry.state !== profile.licenseState)
    issues.push(`Registry license state is ${registry.state}, but the member chose ${profile.licenseState}`);

  if (registry.licenseNumber && normLicense(registry.licenseNumber) !== normLicense(profile.licenseNumber))
    issues.push(`License number ${profile.licenseNumber} does not match the registry's ${registry.licenseNumber}`);

  return { result: issues.length ? "MISMATCH" : "MATCH", issues };
}

// ---------------------------------------------------------------------------
// Matching. Only fit decides who hears about a job; nothing compares one
// practice's pay with another's (antitrust policy).
// ---------------------------------------------------------------------------

export function clinicianFitsJob(
  job: { profession: string; state: string; status: string },
  clinician: { profession: string; licenseState: string; status: string },
): boolean {
  return (
    job.status === "OPEN" &&
    clinician.status === "VERIFIED" &&
    clinician.profession === job.profession &&
    clinician.licenseState === job.state
  );
}

// ---------------------------------------------------------------------------
// Timing windows. Each returns a stable key so a reminder is sent once even
// if the job runs many times inside the window.
// ---------------------------------------------------------------------------

/** 60, 30 and 7 days before a credential expires, or null. */
export function expiryReminderBand(expiresAt: Date, now: Date): 60 | 30 | 7 | 0 | null {
  const days = (expiresAt.getTime() - now.getTime()) / DAY_MS;
  if (days <= 0) return 0;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  if (days <= 60) return 60;
  return null;
}

/** A visit that ended over 2 hours ago and is still "booked" needs recording. */
export function visitNeedsRecording(startsAt: Date, minutes: number, now: Date): boolean {
  return now.getTime() - (startsAt.getTime() + minutes * 60_000) > 2 * HOUR_MS;
}

export function recheckDue(nextRecheckAt: Date | null, now: Date): boolean {
  return nextRecheckAt !== null && nextRecheckAt.getTime() <= now.getTime();
}

// ---------------------------------------------------------------------------
// Messages for members. Short, plain, and free of clinical details. Patient
// emails live in src/lib/email.ts.
// ---------------------------------------------------------------------------

/** Patients aren't offered a time less than this far away: too short to travel. */
export const EARLIER_MIN_LEAD_MS = 2 * 60 * 60_000;

/** The earliest open slot that is before the booked one and at least 2 hours away, or null. */
export function pickEarlierSlot<T extends { startsAt: Date }>(open: T[], bookedAt: Date, now = new Date()): T | null {
  const from = now.getTime() + EARLIER_MIN_LEAD_MS;
  const fits = open.filter((s) => s.startsAt.getTime() >= from && s.startsAt < bookedAt);
  fits.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return fits[0] ?? null;
}

export type Message = { subject: string; body: string };

export const messages = {
  welcome: (name: string): Message => ({
    subject: "Welcome to FindYourDoc: your verification has started",
    body: `Hi ${name},\n\nThanks for joining FindYourDoc. We've started checking your registry details automatically, and a person on our team reviews every new member before they appear. You'll hear from us as soon as you're verified.\n\nFindYourDoc`,
  }),
  verified: (name: string, appUrl: string): Message => ({
    subject: "You're verified on FindYourDoc",
    body: `Hi ${name},\n\nYou're verified. The Lounge, jobs and patient booking are now open to you: ${appUrl}/lounge\n\nWe re-check every license every 90 days to keep the community safe.\n\nFindYourDoc`,
  }),
  jobMatch: (name: string, job: { title: string; city: string; state: string; id: string }, appUrl: string): Message => ({
    subject: `New ${job.state} role that fits your license: ${job.title}`,
    body: `Hi ${name},\n\nA practice just posted a role that matches your profession and license state:\n\n${job.title}, ${job.city}, ${job.state}\n\nThe listing shows what the practice pays, what you take home and our fee: ${appUrl}/jobs#${job.id}\n\nFindYourDoc`,
  }),
  credentialExpiring: (name: string, kind: string, band: number): Message => ({
    subject: band === 0 ? `Your ${kind.toLowerCase()} on FindYourDoc has expired` : `Your ${kind.toLowerCase()} expires in ${band} days`,
    body: `Hi ${name},\n\n${band === 0 ? `Your ${kind.toLowerCase()} on file has expired.` : `Your ${kind.toLowerCase()} on file expires within ${band} days.`} Please upload the renewed document so your profile stays active for practices and patients.\n\nFindYourDoc`,
  }),
  recheckLapsed: (name: string): Message => ({
    subject: "Action needed: we couldn't confirm your license",
    body: `Hi ${name},\n\nOur 90-day re-check couldn't confirm your registry details, so your profile is paused while a person on our team looks at it. Reply to this email if anything changed, such as a new license number or state.\n\nFindYourDoc`,
  }),
  recordVisit: (name: string, count: number, appUrl: string): Message => ({
    subject: `Please record ${count} past visit${count === 1 ? "" : "s"}`,
    body: `Hi ${name},\n\n${count} visit${count === 1 ? " has" : "s have"} ended but ${count === 1 ? "is" : "are"} still marked as booked. Please mark each one completed, no-show or cancelled: ${appUrl}/schedule\n\nNo-shows and cancellations are never charged.\n\nFindYourDoc`,
  }),
  earlierTime: (when: string, link: string): Message => ({
    subject: "An earlier appointment time just opened",
    body: `An earlier time opened with the same clinician: ${when}.\n\nIf you'd like it, move your visit here before someone else books it: ${link}\n\nYour current time stays booked until you change it. To stop these alerts, turn them off on the same page.\n\nFindYourDoc`,
  }),
  loungeReply: (appUrl: string, roomSlug: string): Message => ({
    subject: "New reply to your post in the Lounge",
    body: `A verified member replied to your post. Read it in the Lounge: ${appUrl}/lounge?room=${roomSlug}\n\nFindYourDoc`,
  }),
};
