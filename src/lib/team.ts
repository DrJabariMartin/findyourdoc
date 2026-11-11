// Practice team seats. Solo has one admin; Group and Concierge include
// multiple admins (see PLANS in src/lib/fees.ts).
import { createHash } from "node:crypto";

export const INVITE_DAYS = 7;
export const hashInviteToken = (t: string) => createHash("sha256").update(t).digest("hex");

export function seatLimit(plan: string): number {
  return plan === "SOLO" ? 1 : 25;
}

/** Whether one more person fits, counting members and invites still open. */
export function canInvite(plan: string, members: number, openInvites: number): boolean {
  return members + openInvites < seatLimit(plan);
}
