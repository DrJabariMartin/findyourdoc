export type WaitlistCount = { state: string; role: string; depositIntent: boolean; count: number };
export type StateDemand = { state: string; practices: number; depositPractices: number; clinicians: number; patients: number };

/**
 * Totals per state, ranked by the strongest demand signal first: practices
 * that say they would pay a deposit, then all practices, then clinicians,
 * then patients. Practices rank first because they are the paying side.
 */
export function rankWaitlistStates(counts: WaitlistCount[]): StateDemand[] {
  const by = new Map<string, StateDemand>();
  for (const c of counts) {
    const s = by.get(c.state) ?? { state: c.state, practices: 0, depositPractices: 0, clinicians: 0, patients: 0 };
    if (c.role === "PRACTICE") {
      s.practices += c.count;
      if (c.depositIntent) s.depositPractices += c.count;
    } else if (c.role === "CLINICIAN") s.clinicians += c.count;
    else if (c.role === "PATIENT") s.patients += c.count;
    by.set(c.state, s);
  }
  return [...by.values()].sort(
    (a, b) =>
      b.depositPractices - a.depositPractices ||
      b.practices - a.practices ||
      b.clinicians - a.clinicians ||
      b.patients - a.patients ||
      a.state.localeCompare(b.state),
  );
}
