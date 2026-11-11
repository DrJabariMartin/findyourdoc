// Text messages through AWS End User Messaging SMS, covered by the AWS BAA.
//
// SMS_TRANSPORT: unset or "off" = no texts and no opt-in box (default).
//   "log" = print texts (development). "aws" = send for real, which needs an
//   approved 10DLC registration and SMS_ORIGINATION_IDENTITY (the phone number
//   or its ARN). Carriers handle STOP: AWS adds the number to the opt-out list
//   named in SMS_OPT_OUT_LIST and refuses to text it again.
// Texts never name the clinician, the reason or the insurance.

import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from "@aws-sdk/client-pinpoint-sms-voice-v2";

type Env = Record<string, string | undefined>;
export type Text = { to: string; body: string };
export type SmsTransport = { name: string; send(t: Text): Promise<boolean> };

export function smsMode(env: Env = process.env): "off" | "log" | "aws" {
  const m = env.SMS_TRANSPORT;
  if (m === "log") return "log";
  if (m === "aws" && env.SMS_ORIGINATION_IDENTITY) return "aws";
  return "off";
}

export const smsEnabled = (env: Env = process.env) => smsMode(env) !== "off";

/** US numbers to E.164 (+1XXXXXXXXXX). Anything else returns null and gets no text. */
export function toE164(phone: string): string | null {
  const d = phone.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (ten.length !== 10 || /^[01]/.test(ten) || /^\d{3}[01]/.test(ten)) return null;
  return `+1${ten}`;
}

export function reminderText(when: string, link: string): string {
  return `FindYourDoc: reminder of your appointment ${when}. Details or changes: ${link} Reply STOP to opt out.`;
}

type SmsClient = { send(cmd: SendTextMessageCommand): Promise<unknown> };

export function smsTransport(env: Env = process.env, client?: SmsClient): SmsTransport {
  const mode = smsMode(env);
  if (mode === "log")
    return { name: "log", async send(t) { if (env.NODE_ENV !== "test") console.log(`[sms] to=${t.to} ${t.body}`); return true; } };
  if (mode === "aws") {
    const c = client ?? new PinpointSMSVoiceV2Client({ region: env.AWS_REGION ?? "us-east-1" });
    return {
      name: "aws",
      async send(t) {
        await c.send(new SendTextMessageCommand({
          DestinationPhoneNumber: t.to,
          OriginationIdentity: env.SMS_ORIGINATION_IDENTITY,
          MessageBody: t.body,
          MessageType: "TRANSACTIONAL",
          ...(env.SMS_OPT_OUT_LIST ? { OptOutListName: env.SMS_OPT_OUT_LIST } : {}),
        }));
        return true;
      },
    };
  }
  return { name: "off", async send() { return false; } };
}
