export const PROFESSIONS: Record<string, string> = {
  PHYSICIAN: "Physician",
  NP: "Nurse practitioner",
  PA: "Physician assistant",
  NURSE: "Nurse",
  CRNA: "CRNA",
  PT: "Physical therapist",
  OT: "Occupational therapist",
  PHARMACIST: "Pharmacist",
  OTHER: "Other licensed professional",
};

export const JOB_TYPES: Record<string, string> = {
  LOCUMS: "Locums",
  PERMANENT: "Permanent",
  PER_DIEM: "Per diem",
};

export const REGIONS: Record<string, string> = {
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast", NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest", IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
  DE: "Mid-Atlantic", MD: "Mid-Atlantic", VA: "Mid-Atlantic", DC: "Mid-Atlantic", WV: "Mid-Atlantic", FL: "Southeast", GA: "Southeast", NC: "Southeast", SC: "Southeast", AL: "Southeast", KY: "Southeast", MS: "Southeast", TN: "Southeast", AR: "South", LA: "South", OK: "South", TX: "Texas",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West", UT: "West", WY: "West", AK: "West", CA: "California", HI: "West", OR: "West", WA: "West",
};

export const STATES = Object.keys(REGIONS).sort();

/** The label shown on an anonymous post: role and region only. */
export function anonLabel(specialty: string, profession: string, state: string): string {
  const who = profession === "PHYSICIAN" ? specialty : PROFESSIONS[profession] ?? "Clinician";
  return `${who}, ${REGIONS[state] ?? "US"}`;
}
