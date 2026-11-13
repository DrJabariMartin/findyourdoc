import { PROFESSIONS } from "./labels";

// Plain-language care terms patients type, mapped to the professions and
// specialties that treat them. Matching is generous on purpose: patients
// rarely know the right specialty name.
const CARE_TERMS: Record<string, string[]> = {
  knee: ["orthopedic", "sports", "physical therapist", "PT"],
  back: ["orthopedic", "spine", "physical therapist", "PT", "chiropract"],
  shoulder: ["orthopedic", "sports", "physical therapist", "PT"],
  fracture: ["orthopedic", "urgent"],
  rehab: ["physical therapist", "occupational therapist", "PT", "OT"],
  therapy: ["physical therapist", "occupational therapist", "PT", "OT", "psych", "counsel"],
  hand: ["hand", "occupational therapist", "OT", "orthopedic"],
  checkup: ["family", "primary", "internal", "nurse practitioner", "NP"],
  physical: ["family", "primary", "internal", "nurse practitioner", "NP"],
  cold: ["family", "primary", "urgent", "nurse practitioner", "NP", "PA"],
  flu: ["family", "primary", "urgent", "nurse practitioner", "NP", "PA"],
  skin: ["dermatolog"],
  rash: ["dermatolog", "family", "primary"],
  anxiety: ["psych", "counsel", "mental"],
  depression: ["psych", "counsel", "mental"],
  medication: ["pharmacist", "family", "primary", "internal"],
  heart: ["cardio"],
  pregnancy: ["obstetric", "OB", "midwife", "women"],
};

export function careNeedles(query: string): string[] {
  const words = query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  const out = new Set<string>(words);
  for (const w of words) for (const [term, list] of Object.entries(CARE_TERMS)) if (w.startsWith(term)) list.forEach((x) => out.add(x.toLowerCase()));
  return [...out];
}

export function matchesCare(
  query: string,
  p: { profession: string; specialty: string; bio: string | null },
): boolean {
  if (!query.trim()) return true;
  const hay = `${PROFESSIONS[p.profession] ?? ""} ${p.profession} ${p.specialty} ${p.bio ?? ""}`.toLowerCase();
  return careNeedles(query).some((n) => hay.includes(n.toLowerCase()));
}

export function acceptsInsurance(plan: string, accepted: string | null): boolean {
  if (!plan.trim() || /self|cash|none/i.test(plan)) return true;
  return (accepted ?? "").toLowerCase().split(",").some((a) => a.trim() && (a.includes(plan.toLowerCase().trim()) || plan.toLowerCase().includes(a.trim())));
}

// "Who can help with this": the plain-language answer shown before results,
// so patients learn which kinds of clinicians treat their need. It names
// professions only. It is not medical advice and never ranks anyone.
const HELPERS: Record<string, string[]> = {
  knee: ["orthopedic surgeons", "sports medicine physicians", "physical therapists"],
  back: ["primary care clinicians", "spine and orthopedic specialists", "physical therapists"],
  shoulder: ["orthopedic surgeons", "sports medicine physicians", "physical therapists"],
  fracture: ["orthopedic surgeons", "urgent care clinicians"],
  rehab: ["physical therapists", "occupational therapists"],
  hand: ["hand surgeons", "occupational therapists"],
  checkup: ["family physicians", "internists", "nurse practitioners"],
  physical: ["family physicians", "internists", "nurse practitioners"],
  cold: ["family physicians", "nurse practitioners", "physician assistants"],
  flu: ["family physicians", "nurse practitioners", "physician assistants"],
  skin: ["dermatologists"],
  rash: ["dermatologists", "primary care clinicians"],
  anxiety: ["psychiatrists", "psychiatric nurse practitioners", "counselors"],
  depression: ["psychiatrists", "psychiatric nurse practitioners", "counselors"],
  medication: ["pharmacists", "primary care clinicians"],
  heart: ["cardiologists"],
  pregnancy: ["obstetricians", "midwives"],
};

/** Common needs offered as one-tap starting points on the search page. */
export const COMMON_NEEDS = ["Knee pain", "Back pain", "Checkup", "Physical therapy", "Skin rash", "Anxiety", "Flu or cold", "Medication review"];

export function whoCanHelp(query: string): string[] {
  const words = query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  const out = new Set<string>();
  for (const w of words) for (const [term, list] of Object.entries(HELPERS)) if (w.startsWith(term)) list.forEach((x) => out.add(x));
  return [...out];
}
