// Founding-practice deposit: refundable $99, credited to the first paid month.
// Off until counsel signs off on pricing and the company's Stripe account is
// set up. Turning it on needs both DEPOSITS_ENABLED="true" and a Stripe
// Payment Link in FOUNDING_DEPOSIT_URL. Only practices are ever asked.
export const FOUNDING_DEPOSIT_CENTS = 9_900;

type Env = Record<string, string | undefined>;

/** The payment link to show, or null while deposits are off or misconfigured. */
export function depositLink(env: Env, email?: string): string | null {
  if (env.DEPOSITS_ENABLED !== "true") return null;
  const raw = env.FOUNDING_DEPOSIT_URL;
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !/(^|\.)stripe\.com$/.test(url.hostname)) return null;
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}
