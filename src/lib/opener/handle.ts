// Decides what happens to one incoming DM or comment.
//
// OPENER_MODE (default "off"):
//   off   - do nothing (the webhook still answers Meta so it stays subscribed)
//   draft - nothing is sent; Dr. Martin gets each proposed reply by email
//   send  - templates and AI replies the checks allow are sent; the rest are
//           emailed to Dr. Martin
//
// Privacy: patient messages are never sent to the AI and their text is never
// copied into an email or log. Dr. Martin is only told to open the inbox.

import { decide, type Decision } from "./ai";
import { route } from "./guard";
import { sendReply, type Incoming } from "./meta";
import { DISCLOSURE, KEYWORDS, patient } from "./templates";

export type Outcome = {
  route: string;
  action: "sent" | "drafted" | "escalated" | "urgent" | "ignored";
  reply?: string;
  /** Email to Dr. Martin, if any. Never contains patient text. */
  notify?: { subject: string; text: string };
};

export type Deps = {
  mode?: string;
  decide?: (e: Incoming) => Promise<Decision | null>;
};

function withDisclosure(text: string) {
  // We do not store conversation history yet, so every automated reply carries the disclosure.
  return `${text}\n\n${DISCLOSURE}`;
}

const where = (e: Incoming) => `${e.platform} ${e.kind === "comment" ? "comment" : "DM"}`;

export async function plan(e: Incoming, deps: Deps = {}): Promise<Outcome> {
  const mode = deps.mode ?? process.env.OPENER_MODE ?? "off";
  if (mode !== "draft" && mode !== "send") return { route: "off", action: "ignored" };
  const live = mode === "send";
  const r = route(e.text);

  if (r.kind === "crisis") {
    return {
      route: "crisis",
      action: "urgent",
      reply: live ? patient.crisis() : undefined,
      notify: {
        subject: "URGENT: possible crisis message",
        text: `A ${where(e)} matched a crisis word. ${live ? "The 988/911 reply was sent." : "Nothing was sent (draft mode)."} Open the inbox now and reply personally.`,
      },
    };
  }

  if (r.kind === "keyword") {
    const reply = withDisclosure(KEYWORDS[r.keyword].reply());
    if (live) return { route: `keyword:${r.keyword}`, action: "sent", reply };
    return { route: `keyword:${r.keyword}`, action: "drafted", notify: { subject: `Draft reply: ${r.keyword}`, text: `${where(e)} with keyword ${r.keyword}. Suggested reply:\n\n${reply}` } };
  }

  if (r.kind === "patient") {
    const reply = withDisclosure(patient[r.template]());
    if (live) return { route: "patient", action: "sent", reply };
    return { route: "patient", action: "drafted", notify: { subject: "Patient message: send the booking template", text: `A ${where(e)} looks like a patient. Send the "${r.template}" template from the playbook. (Message not copied here, for privacy.)` } };
  }

  if (r.kind === "human") {
    return { route: "human", action: "escalated", notify: { subject: "Reply needed by hand", text: `A ${where(e)} mentions health and work together, so the AI did not read it. Please reply from the inbox.` } };
  }

  const d = await (deps.decide ?? decide)(e);
  if (!d) return { route: "ai", action: "escalated", notify: { subject: "AI Opener could not answer", text: `A ${where(e)} needs a reply. Message:\n\n${e.text}` } };
  if (d.action === "no_reply") return { route: "ai", action: "ignored" };
  const proposed = d.messages.join("\n\n");
  if (live && d.action === "send") return { route: "ai", action: "sent", reply: withDisclosure(proposed) };
  const urgent = d.action === "escalate_urgent";
  return {
    route: "ai",
    action: urgent ? "urgent" : d.action === "escalate" ? "escalated" : "drafted",
    notify: {
      subject: `${urgent ? "URGENT: " : ""}AI Opener ${d.action.replace(/_/g, " ")} (${d.audience})`,
      text: `${where(e)}:\n\n${e.text}\n\nProposed reply:\n\n${proposed || "(none)"}\n\nWhy: ${d.reason}\nPipeline: ${JSON.stringify(d.pipeline_update ?? {})}`,
    },
  };
}

/** Runs the plan: sends the reply (if any) and emails Dr. Martin (if needed). */
export async function handle(e: Incoming, deps: Deps = {}): Promise<Outcome> {
  const o = await plan(e, deps);
  if (o.reply) await sendReply(e, o.reply);
  const to = process.env.OPENER_NOTIFY_EMAIL;
  if (o.notify && to) {
    const { send } = await import("../email");
    await send({ to, subject: `[FindYourDoc DMs] ${o.notify.subject}`, text: o.notify.text }, "OPENER");
  }
  return o;
}
