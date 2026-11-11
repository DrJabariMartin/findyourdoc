import { randomBytes } from "node:crypto";

// A practice's own booking link: /b/<code>. The practice puts it on its
// website, its link-in-bio page, its emails and a QR code at the front desk.
// Patients who book through it came from the practice's own marketing, so
// FindYourDoc never charges a booking fee for them. The code is random so the
// link can't be guessed from a profile URL.

export function newBookingCode(): string {
  return randomBytes(9).toString("base64url");
}

export function isBookingCode(s: string | undefined): s is string {
  return !!s && /^[A-Za-z0-9_-]{8,40}$/.test(s);
}

/** Where a booking came from: the practice's own link, or FindYourDoc search. */
export function bookingSource(clinicianCode: string | null | undefined, ref: string | undefined): "PRACTICE_SITE" | "FINDYOURDOC" {
  return clinicianCode && ref && ref === clinicianCode ? "PRACTICE_SITE" : "FINDYOURDOC";
}
