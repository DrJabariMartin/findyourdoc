// Pricing rules from the business plan. Kept pure so they can be unit tested.
// The clinician always keeps 100% of their rate. FindYourDoc never takes a
// percentage of professional fees.

export const LOCUMS_FEE_RATE = 0.12; // added on top, paid by the practice
export const PERMANENT_HIRE_FEE_CENTS = 950_000; // $9,500 flat
export const CONVERSION_WINDOW_MONTHS = 12;

export type JobType = "LOCUMS" | "PERMANENT" | "PER_DIEM";

/** What the practice pays per unit for an hourly job, in cents. */
export function billRateCents(clinicianPayCents: number): number {
  return Math.round(clinicianPayCents * (1 + LOCUMS_FEE_RATE));
}

/** Our fee per unit for an hourly job, in cents. */
export function hourlyFeeCents(clinicianPayCents: number): number {
  return billRateCents(clinicianPayCents) - clinicianPayCents;
}

/**
 * Fee for hiring a locum permanently. It falls in a straight line from the
 * full permanent fee to $0 over the conversion window, so the practice is
 * never locked in. Replaces any non-circumvention or non-compete clause.
 */
export function conversionFeeCents(monthsWorked: number): number {
  if (monthsWorked <= 0) return PERMANENT_HIRE_FEE_CENTS;
  if (monthsWorked >= CONVERSION_WINDOW_MONTHS) return 0;
  const left = (CONVERSION_WINDOW_MONTHS - monthsWorked) / CONVERSION_WINDOW_MONTHS;
  return Math.round((PERMANENT_HIRE_FEE_CENTS * left) / 100) * 100;
}

export function dollars(cents: number): string {
  const whole = cents % 100 === 0;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function range(min: number, max: number, suffix: string): string {
  return min === max ? `${dollars(min)}${suffix}` : `${dollars(min)} to ${dollars(max)}${suffix}`;
}

/** The three numbers every listing must show. */
export function listingMoney(job: {
  type: string;
  payUnit: string;
  payMinCents: number;
  payMaxCents: number;
}) {
  const suffix = job.payUnit === "HOUR" ? "/hr" : "/yr";
  if (job.type === "PERMANENT") {
    return {
      practicePays: range(job.payMinCents, job.payMaxCents, suffix),
      youTakeHome: range(job.payMinCents, job.payMaxCents, suffix),
      ourFee: `${dollars(PERMANENT_HIRE_FEE_CENTS)} flat, paid by the practice`,
    };
  }
  return {
    practicePays: range(billRateCents(job.payMinCents), billRateCents(job.payMaxCents), suffix),
    youTakeHome: range(job.payMinCents, job.payMaxCents, suffix),
    ourFee: `12% on top (${range(hourlyFeeCents(job.payMinCents), hourlyFeeCents(job.payMaxCents), suffix)}), paid by the practice`,
  };
}

// Patient booking: a flat fee set in advance, charged only for a completed
// visit by a new patient who found the clinician on FindYourDoc. No fee for
// no-shows, cancellations, existing patients or the practice's own website.
export const BOOKING_FEE_CENTS = 4_000; // $40

// No fee is ever charged for a patient covered by a federal or state health
// program (Medicare, Medicare Advantage, Medicaid, CHIP, TRICARE, VA). A
// per-patient fee tied to those patients could be treated as payment for
// referrals under the federal Anti-Kickback Statute. Zocdoc took the same
// approach in OIG Advisory Opinion 19-04. Ranking ignores this entirely.
const GOVERNMENT_PLAN = /medicare|medicaid|medi-cal|\bchip\b|peachcare|tricare|champva|\bva\b|veterans|indian health/i;

export function isGovernmentPlan(insurance: string | null | undefined): boolean {
  return !!insurance && GOVERNMENT_PLAN.test(insurance);
}

export function bookingFeeCents(appt: { status: string; newPatient: boolean; source: string; governmentPlan?: boolean }): number {
  if (appt.governmentPlan) return 0;
  return appt.status === "COMPLETED" && appt.newPatient && appt.source === "FINDYOURDOC" ? BOOKING_FEE_CENTS : 0;
}

// Practice plans: a self-serve tier, a core tier and a done-for-you tier.
// Hire, locums and booking fees are the same on every plan, so the numbers a
// practice sees never depend on which tier it bought.
export type PlanId = "SOLO" | "GROUP" | "CONCIERGE";

export const PLANS: { id: PlanId; name: string; monthlyCents: number; who: string; includes: string[] }[] = [
  {
    id: "SOLO",
    name: "Solo",
    monthlyCents: 29_900,
    who: "1 to 5 physicians. You run your own hiring.",
    includes: ["Post locums shifts and permanent roles", "Search verified clinicians", "Review credential packets", "Patient booking on your clinicians' profiles"],
  },
  {
    id: "GROUP",
    name: "Group",
    monthlyCents: 79_900,
    who: "6 or more physicians, ASCs and urgent care. Our core plan.",
    includes: ["Everything in Solo", "Multiple admins and locations", "Shared hiring pipeline for the whole group", "Priority verification for your candidates"],
  },
  {
    id: "CONCIERGE",
    name: "Concierge",
    monthlyCents: 199_900,
    who: "We run the hiring for you.",
    includes: ["Everything in Group", "A hiring coordinator writes your listings", "3 verified, interested candidates per role within 14 days", "Interviews scheduled for you"],
  },
];

// Guarantees. We sell outcomes, so each paid product carries one.
export const HIRE_GUARANTEE_DAYS = 90;
export const LOCUMS_CANCEL_GUARANTEE_DAYS = 14;
export const CONCIERGE_SHORTLIST_DAYS = 14;
export const CONCIERGE_SHORTLIST_SIZE = 3;

/**
 * Fee for a permanent hire. If the practice's previous permanent hire through
 * FindYourDoc left within the guarantee window, this hire has no fee.
 */
export function permanentHireFeeCents(previousHireDaysWorked?: number): number {
  return previousHireDaysWorked !== undefined && previousHireDaysWorked < HIRE_GUARANTEE_DAYS ? 0 : PERMANENT_HIRE_FEE_CENTS;
}

/** Our fee on a replacement locum is waived when a confirmed locum cancels close to the start. */
export function replacementLocumsFeeWaived(daysNoticeBeforeStart: number): boolean {
  return daysNoticeBeforeStart < LOCUMS_CANCEL_GUARANTEE_DAYS;
}

/**
 * Concierge fee for a month: waived if any role missed its shortlist in time.
 * daysToShortlist is null while a role still has no full shortlist.
 */
export function conciergeMonthCents(roles: { openedDaysAgo: number; daysToShortlist: number | null }[]): number {
  const late = (days: number) => days > CONCIERGE_SHORTLIST_DAYS;
  const missed = roles.some((r) => (r.daysToShortlist === null ? late(r.openedDaysAgo) : late(r.daysToShortlist)));
  return missed ? 0 : PLANS.find((p) => p.id === "CONCIERGE")!.monthlyCents;
}
