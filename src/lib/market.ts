// Where patients can book, and with whom. Pure functions so the rules can be
// unit tested.
//
// Two rules decide every booking:
//  1. Launch market. Booking is open only in the launch states (LAUNCH_STATES,
//     default DC, Maryland and Virginia). Other states go to the waitlist.
//  2. Licensure follows the patient. An in-person visit happens in the office's
//     state; a video visit happens wherever the patient is. Either way the
//     clinician needs a verified, unexpired license in that state. Maryland
//     (Health Occupations 1-1005, COMAR 10.32.05.03) requires a Maryland
//     license to treat a patient located in Maryland, including by telehealth.

export const DEFAULT_LAUNCH_STATES = ["MD", "DC", "VA"];

export type VisitMode = "IN_PERSON" | "VIDEO";
export const VISIT_MODES: Record<VisitMode, string> = { IN_PERSON: "In person", VIDEO: "Video" };

export function launchStates(env: Record<string, string | undefined> = process.env): string[] {
  const list = (env.LAUNCH_STATES ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s));
  return list.length ? [...new Set(list)] : DEFAULT_LAUNCH_STATES;
}

export type LicenseHolder = {
  status: string;
  licenseState: string;
  licenses?: { state: string; expiresAt: Date | null }[];
};

/** States where this clinician may see a patient right now. Empty unless verified. */
export function licensedStates(c: LicenseHolder, now = new Date()): string[] {
  if (c.status !== "VERIFIED") return [];
  const out = new Set([c.licenseState]);
  for (const l of c.licenses ?? []) if (!l.expiresAt || l.expiresAt > now) out.add(l.state);
  return [...out].sort();
}

/** States a video patient may book from: licensed and in the launch market. */
export function videoStates(c: LicenseHolder, launch: string[], now = new Date()): string[] {
  return licensedStates(c, now).filter((s) => launch.includes(s));
}

/**
 * The state whose law governs the visit, or an error to show the patient.
 * In person: the office's state. Video: the state the patient will be in.
 */
export function visitState(
  mode: string,
  c: LicenseHolder & { officeState: string | null },
  patientState: string | undefined,
  launch: string[],
  now = new Date(),
): { state: string } | { error: string } {
  const licensed = licensedStates(c, now);
  if (mode === "VIDEO") {
    if (!patientState) return { error: "Choose the state you'll be in during the video visit" };
    if (!launch.includes(patientState)) return { error: `Video visits aren't open in ${patientState} yet. Join the waitlist and we'll tell you when they are.` };
    if (!licensed.includes(patientState))
      return { error: `This clinician isn't licensed in ${patientState}, so they can't see you by video while you're there. Choose an in-person time or another clinician.` };
    return { state: patientState };
  }
  const office = c.officeState ?? "";
  if (!launch.includes(office)) return { error: "Booking isn't open in this state yet" };
  if (!licensed.includes(office)) return { error: "This clinician can't take in-person bookings at this office yet" };
  return { state: office };
}

/**
 * Whether a clinician shows in search for a patient in `state` (or anywhere in
 * the launch market when no state is chosen): an office there, or a video
 * license there.
 */
export function servesState(
  c: LicenseHolder & { officeState: string | null },
  state: string | undefined,
  launch: string[],
  offersVideo: boolean,
  now = new Date(),
): boolean {
  const licensed = licensedStates(c, now);
  const inPerson = (s: string) => c.officeState === s && licensed.includes(s);
  const video = (s: string) => offersVideo && licensed.includes(s);
  const targets = state ? (launch.includes(state) ? [state] : []) : launch;
  return targets.some((s) => inPerson(s) || video(s));
}
