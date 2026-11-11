// Verified patient reviews and the trust signals shown next to them.
//
// Rules, from the FTC rule on reviews (16 CFR 465) and from what patients say
// goes wrong on other booking sites:
// - Only a patient whose visit was booked here and marked completed can review.
// - Every review is shown, good or bad. Nothing is filtered by rating.
// - No incentives of any kind for leaving a review.
// - The patient can edit or delete their review at any time; we never change
//   their words or their star rating.
// - A clinician may reply once, in public, and may report a review that breaks
//   the content rules. It stays visible until an admin agrees.

export const REVIEW_EDIT_DAYS = 365;
export const INSURANCE_FRESH_DAYS = 90;
const DAY = 86_400_000;

/** The only reasons a clinician may report a review. A low rating is not one of them. */
export const REPORT_REASONS = [
  "Contains private health or personal details",
  "Threat, harassment or hate",
  "Not about a visit with me",
  "Spam or advertising",
] as const;

type ApptForReview = { status: string; slot: { startsAt: Date } };

/** Whether this appointment can leave (or still edit) a review. */
export function canReview(a: ApptForReview, now = new Date()): boolean {
  if (a.status !== "COMPLETED") return false;
  return now.getTime() - a.slot.startsAt.getTime() <= REVIEW_EDIT_DAYS * DAY;
}

export type RatingSummary = { count: number; average: number | null; histogram: number[] };

/** Average and 5..1 star counts over every shown review. */
export function summarize(ratings: number[]): RatingSummary {
  const histogram = [0, 0, 0, 0, 0];
  for (const r of ratings) if (r >= 1 && r <= 5) histogram[5 - r]++;
  const count = histogram.reduce((a, b) => a + b, 0);
  const total = histogram.reduce((sum, n, i) => sum + n * (5 - i), 0);
  return { count, average: count ? Math.round((total / count) * 10) / 10 : null, histogram };
}

/** What the patient sees about the insurance list's freshness. */
export function insuranceStatus(confirmedAt: Date | null, now = new Date()): { fresh: boolean; label: string } {
  if (!confirmedAt) return { fresh: false, label: "The office hasn't confirmed its insurance list yet. Call to check before your visit." };
  const days = Math.floor((now.getTime() - confirmedAt.getTime()) / DAY);
  const when = confirmedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  if (days > INSURANCE_FRESH_DAYS) return { fresh: false, label: `Last confirmed by the office on ${when}, over ${INSURANCE_FRESH_DAYS} days ago. Call to check.` };
  return { fresh: true, label: `Confirmed by the office on ${when}` };
}

/** Whether the profile form's insurance list differs from what's saved. */
export function insuranceChanged(before: string | null, after: string | null): boolean {
  const norm = (s: string | null) => (s ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).sort().join(",");
  return norm(before) !== norm(after);
}

/** The newest date we confirmed this clinician: admin verification or a clean registry re-check. */
export function lastVerified(verifiedAt: Date | null, matchChecks: { createdAt: Date }[]): Date | null {
  const dates = [verifiedAt, ...matchChecks.map((c) => c.createdAt)].filter((d): d is Date => d instanceof Date);
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}
