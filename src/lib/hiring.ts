// How quickly a practice answers applicants. Shown on its listings so
// clinicians can avoid practices that leave people waiting.

const HOUR = 3_600_000;
export const RESPONSE_WINDOW_DAYS = 180;
export const MIN_APPLICATIONS = 3;

type App = { createdAt: Date; firstResponseAt: Date | null };

/**
 * Median hours to first response over recent applications. An application
 * still unanswered counts as waiting until now, so ignoring people can only
 * make the number worse. Returns null when there are too few to judge.
 */
export function medianResponseHours(apps: App[], now = new Date()): number | null {
  const recent = apps.filter((a) => now.getTime() - a.createdAt.getTime() <= RESPONSE_WINDOW_DAYS * 24 * HOUR);
  if (recent.length < MIN_APPLICATIONS) return null;
  const hours = recent
    .map((a) => ((a.firstResponseAt ?? now).getTime() - a.createdAt.getTime()) / HOUR)
    .sort((x, y) => x - y);
  const mid = Math.floor(hours.length / 2);
  return hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
}

export function responseLabel(hours: number | null): string {
  if (hours === null) return "New on FindYourDoc: not enough applications yet to show a response time";
  if (hours <= 24) return "Usually responds within a day";
  if (hours <= 72) return "Usually responds within 3 days";
  if (hours <= 168) return "Usually responds within a week";
  return "Often slow to respond (over a week)";
}

/** Documents a practice may open: only when the clinician shared them, and only verified ones. */
export function practiceMayOpen(a: { shareDocs: boolean } | null, credentialStatus: string): boolean {
  return !!a?.shareDocs && credentialStatus === "VERIFIED";
}
