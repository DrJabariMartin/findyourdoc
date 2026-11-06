// Delivers outbox emails. Sending real email needs a HIPAA-eligible provider
// with a signed BAA (appointment emails count as protected health
// information), and choosing one is a spending decision for the founder.
// Until EMAIL_TRANSPORT is set to a real provider:
//   - "log"  (the default outside production) prints each email and marks it sent
//   - "hold" (the default in production) leaves emails queued, so nothing is lost

export type OutgoingEmail = { to: string; subject: string; body: string };

export type Transport = {
  name: string;
  /** Returns false to leave the email queued. Throws on a delivery error. */
  send(email: OutgoingEmail): Promise<boolean>;
};

const logTransport: Transport = {
  name: "log",
  async send(email) {
    console.log(`[email] to=${email.to} subject="${email.subject}"`);
    return true;
  },
};

const holdTransport: Transport = {
  name: "hold",
  async send() {
    return false;
  },
};

export function transport(): Transport {
  const chosen = process.env.EMAIL_TRANSPORT ?? (process.env.NODE_ENV === "production" ? "hold" : "log");
  if (chosen === "log") return logTransport;
  return holdTransport;
}
