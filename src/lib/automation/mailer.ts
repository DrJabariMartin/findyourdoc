// Delivers outbox emails. Appointment emails count as protected health
// information, so real sending must go through a provider covered by a signed
// BAA. FindYourDoc's choice is Amazon SES under the AWS BAA (see
// docs/launch.md). EMAIL_TRANSPORT picks the transport:
//   - "log"  (the default outside production) prints each email and marks it sent
//   - "hold" (the default in production) leaves emails queued, so nothing is lost
//   - "ses"  sends through Amazon SES. Turn it on only after the AWS BAA is
//            accepted and the sending domain is verified.

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export type OutgoingEmail = { to: string; subject: string; body: string };

export type Transport = {
  name: string;
  /** Returns false to leave the email queued. Throws on a delivery error. */
  send(email: OutgoingEmail): Promise<boolean>;
};

const logTransport: Transport = {
  name: "log",
  async send(email) {
    if (process.env.NODE_ENV !== "test") console.log(`[email] to=${email.to} subject="${email.subject}"`);
    return true;
  },
};

const holdTransport: Transport = {
  name: "hold",
  async send() {
    return false;
  },
};

type SesLike = { send(command: SendEmailCommand): Promise<unknown> };

/** Builds the SES request for one email. Exported for tests. */
export function sesCommand(email: OutgoingEmail, from: string, configurationSet?: string) {
  return new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [email.to] },
    Content: {
      Simple: {
        Subject: { Data: email.subject, Charset: "UTF-8" },
        Body: { Text: { Data: email.body, Charset: "UTF-8" } },
      },
    },
    ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
  });
}

export function sesTransport(client?: SesLike): Transport {
  const from = process.env.EMAIL_FROM;
  // Without a sender address nothing can go out, so keep emails queued.
  if (!from) return { ...holdTransport, name: "ses (held: EMAIL_FROM missing)" };
  // Credentials come from the host's IAM role or the standard AWS_* variables.
  const ses = client ?? new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  const configurationSet = process.env.SES_CONFIGURATION_SET || undefined;
  return {
    name: "ses",
    async send(email) {
      await ses.send(sesCommand(email, from, configurationSet));
      return true;
    },
  };
}

export function transport(): Transport {
  const chosen = process.env.EMAIL_TRANSPORT ?? (process.env.NODE_ENV === "production" ? "hold" : "log");
  if (chosen === "log") return logTransport;
  if (chosen === "ses") return sesTransport();
  return holdTransport;
}
