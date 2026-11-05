// Looks up an NPI in the public NPPES registry to prefill a profile.
// An NPI proves identity in the registry, not a valid license, so the admin
// still checks the state license and board before verifying anyone.

export type NpiResult = {
  npi: string;
  name: string;
  credential: string | null;
  taxonomy: string | null;
  state: string | null;
  licenseNumber: string | null;
};

export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  // Luhn check with the 80840 prefix, per the NPI standard.
  const digits = ("80840" + npi).split("").map(Number);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[digits.length - 1 - i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export async function lookupNpi(npi: string): Promise<NpiResult | null> {
  if (!isValidNpi(npi)) return null;
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    const basic = r.basic ?? {};
    const tax = (r.taxonomies ?? []).find((t: { primary?: boolean }) => t.primary) ?? r.taxonomies?.[0];
    return {
      npi,
      name: [basic.first_name, basic.last_name].filter(Boolean).join(" ") || basic.organization_name || "",
      credential: basic.credential ?? null,
      taxonomy: tax?.desc ?? null,
      state: tax?.state ?? null,
      licenseNumber: tax?.license ?? null,
    };
  } catch {
    return null;
  }
}
