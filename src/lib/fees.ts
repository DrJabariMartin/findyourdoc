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

export function bookingFeeCents(appt: { status: string; newPatient: boolean; source: string }): number {
  return appt.status === "COMPLETED" && appt.newPatient && appt.source === "FINDYOURDOC" ? BOOKING_FEE_CENTS : 0;
}
