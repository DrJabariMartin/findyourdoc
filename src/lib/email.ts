// Outgoing email. Every message goes through send(), so swapping in a real
// provider is a one-file change. Before launch, use a provider that signs a
// HIPAA business associate agreement: appointment emails reveal that a person
// has a visit with a clinician.
//
// Messages carry the minimum needed: no visit reason, no insurance details.

export type Email = { to: string; subject: string; text: string };

const outbox: Email[] = [];

/** Emails sent in this process, newest last. Used by tests and the dev console provider. */
export function sentEmails(): readonly Email[] {
  return outbox;
}

export async function send(msg: Email): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";
  outbox.push(msg);
  if (outbox.length > 200) outbox.shift();
  if (provider === "console") {
    if (process.env.NODE_ENV !== "test") console.log(`[email] to=${msg.to} subject="${msg.subject}"\n${msg.text}\n`);
    return;
  }
  throw new Error(`EMAIL_PROVIDER "${provider}" is not set up yet`);
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
