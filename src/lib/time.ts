// Appointment times are shown in the office's local time zone, never the
// server's. One primary zone per state; split-zone states use the zone most
// of their population lives in.
const ZONES: Record<string, string[]> = {
  "America/New_York": ["CT","DE","DC","FL","GA","IN","KY","ME","MD","MA","MI","NH","NJ","NY","NC","OH","PA","RI","SC","VT","VA","WV"],
  "America/Chicago": ["AL","AR","IL","IA","KS","LA","MN","MS","MO","NE","ND","OK","SD","TN","TX","WI"],
  "America/Denver": ["CO","ID","MT","NM","UT","WY"],
  "America/Phoenix": ["AZ"],
  "America/Los_Angeles": ["CA","NV","OR","WA"],
  "America/Anchorage": ["AK"],
  "Pacific/Honolulu": ["HI"],
};
const BY_STATE: Record<string, string> = Object.fromEntries(Object.entries(ZONES).flatMap(([z, ss]) => ss.map((s) => [s, z])));

export function zoneFor(state: string | null | undefined): string {
  return (state && BY_STATE[state]) || "America/New_York";
}

export function fmtSlot(d: Date, state: string | null | undefined, style: "short" | "day" | "time" | "long" = "short"): string {
  const timeZone = zoneFor(state);
  const opts: Record<string, Intl.DateTimeFormatOptions> = {
    short: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
    day: { weekday: "long", month: "short", day: "numeric" },
    time: { hour: "numeric", minute: "2-digit" },
    long: { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" },
  };
  return d.toLocaleString("en-US", { ...opts[style], timeZone });
}

/** Minutes the zone is ahead of UTC at that instant (New York in winter: -300). */
function zoneOffsetMinutes(at: number, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(at)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - at) / 60_000);
}

/** "2030-03-12" + "09:00" on the office's wall clock, as a UTC instant. Handles daylight saving. */
export function officeTimeToUtc(date: string, hm: string, state: string | null | undefined): Date {
  const zone = zoneFor(state);
  const naive = Date.parse(`${date}T${hm}:00Z`);
  let t = naive - zoneOffsetMinutes(naive, zone) * 60_000;
  t = naive - zoneOffsetMinutes(t, zone) * 60_000;
  return new Date(t);
}

/** The same date string moved forward by whole days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
