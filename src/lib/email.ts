import { randomUUID } from "node:crypto";
import { transport } from "./automation/mailer";

// Outgoing transactional email (bookings, reminders, password reset). It is
// delivered through the same transport as the automations
// (src/lib/automation/mailer.ts: log, hold or Amazon SES under the AWS BAA).
// Appointment emails reveal that a person has a visit with a clinician, so
// they only leave through a provider covered by a BAA.
//
// Messages carry the minimum needed: no visit reason, no insurance details.

export type Email = { to: string; subject: string; text: string };

const outbox: Email[] = [];

/** Emails sent in this process, newest last. Used by tests and the dev console provider. */
export function sentEmails(): readonly Email[] {
  return outbox;
}

/**
 * Sends now when the transport can. If it is holding email (production before
 * SES is on) or delivery fails, the message goes into the outbox and the
 * hourly deliver-outbox job retries it, so nothing is lost.
 */
export async function send(msg: Email, kind = "TRANSACTIONAL"): Promise<void> {
  outbox.push(msg);
  if (outbox.length > 200) outbox.shift();
  const email = { to: msg.to, subject: msg.subject, body: msg.text };
  try {
    if (await transport().send(email)) return;
  } catch (e) {
    console.error(`[email] delivery failed, queued for retry: ${(e as Error).message}`);
  }
  const { db } = await import("./db");
  await db.notification.create({
    data: { dedupeKey: `direct:${randomUUID()}`, toEmail: msg.to, kind, subject: msg.subject, body: msg.text },
  });
}

export function appUrl(path: string): string {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}

type Visit = { when: string; clinician: string; office: string; manageUrl: string };

export function bookingConfirmation(to: string, v: Visit): Email {
  return {
    to,
    subject: "Your appointment is booked",
    text: `You're booked for ${v.when} with ${v.clinician}.\n\n${v.office}\n\nView or cancel: ${v.manageUrl}\n\nFor an emergency, call 911.\n— FindYourDoc`,
  };
}

export function bookingReminder(to: string, v: Visit): Email {
  return {
    to,
    subject: "Reminder: your appointment is tomorrow",
    text: `This is a reminder of your visit on ${v.when} with ${v.clinician}.\n\n${v.office}\n\nCan't make it? Cancel here so someone else can have the time: ${v.manageUrl}\n— FindYourDoc`,
  };
}

export function bookingCancelled(to: string, v: Omit<Visit, "manageUrl">): Email {
  return {
    to,
    subject: "Your appointment was cancelled",
    text: `Your visit on ${v.when} with ${v.clinician} is cancelled. You can book a new time at ${appUrl("/find")}.\n— FindYourDoc`,
  };
}

export function bookingRescheduled(to: string, v: Visit): Email {
  return {
    to,
    subject: "Your appointment has a new time",
    text: `Your visit is now ${v.when} with ${v.clinician}.\n\n${v.office}\n\nView, change or cancel: ${v.manageUrl}\n— FindYourDoc`,
  };
}

/**
 * Sent once after a completed visit. It offers nothing in return and says a
 * critical review is as welcome as a kind one (FTC rule on reviews).
 */
export function reviewInvite(to: string, v: Visit): Email {
  return {
    to,
    subject: "How was your visit?",
    text: `You saw ${v.clinician} on ${v.when}. If you'd like, tell other patients how it went: ${v.manageUrl}\n\nEvery review is published, good or bad, and you can edit or delete yours at any time. Please leave out personal health details.\n— FindYourDoc`,
  };
}

export function newBookingForClinician(to: string, when: string): Email {
  // The clinician sees patient details after logging in, not in the email.
  return {
    to,
    subject: "New patient booking",
    text: `A patient booked ${when}. Log in to see the details: ${appUrl("/schedule")}\n— FindYourDoc`,
  };
}

export function passwordReset(to: string, url: string): Email {
  return {
    to,
    subject: "Reset your FindYourDoc password",
    text: `Use this link within 1 hour to set a new password:\n${url}\n\nIf you didn't ask for this, you can ignore this email.\n— FindYourDoc`,
  };
}

export function teamInvite(to: string, practice: string, inviter: string, url: string): Email {
  return {
    to,
    subject: `${inviter} invited you to ${practice} on FindYourDoc`,
    text: `${inviter} added you to ${practice}'s hiring team on FindYourDoc. Set up your account within 7 days:\n${url}\n\nIf you weren't expecting this, you can ignore this email.\n— FindYourDoc`,
  };
}
