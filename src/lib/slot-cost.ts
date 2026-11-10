// The empty provider slot calculator (a practice lead magnet).
// Monthly revenue lost = visits per day x collected per visit x clinic days per month.

export type SlotInput = { visitsPerDay: number; perVisit: number; daysPerMonth: number; monthsOpen: number };

const ok = (n: number, max: number) => (Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0);

/** Whole dollars. Blank, negative or nonsense inputs count as 0; inputs are capped at sane maximums. */
export function slotCost(i: SlotInput): { monthly: number; soFar: number } {
  const monthly = Math.round(ok(i.visitsPerDay, 200) * ok(i.perVisit, 10_000) * ok(i.daysPerMonth, 31));
  return { monthly, soFar: Math.round(monthly * ok(i.monthsOpen, 120)) };
}
