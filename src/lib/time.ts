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
