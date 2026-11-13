// Calls Claude with the AI Opener system prompt (prompts/ai-opener-dm-agent.md)
// and checks its answer before anything can be sent. Only clinician, practice
// and "other" messages ever reach this file; guard.ts keeps patients out.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Incoming } from "./meta";

export const Decision = z.object({
  audience: z.enum(["clinician", "practice", "patient", "other"]),
  action: z.enum(["send", "draft_for_jabari", "escalate", "escalate_urgent", "no_reply"]),
  messages: z.array(z.string()).default([]),
  pipeline_update: z.record(z.unknown()).optional(),
  reason: z.string().default(""),
});
export type Decision = z.infer<typeof Decision>;

let cachedPrompt: string | null = null;
function systemPrompt() {
  cachedPrompt ??= readFileSync(join(process.cwd(), "prompts", "ai-opener-dm-agent.md"), "utf8");
  return cachedPrompt;
}

/** Pulls the first JSON object out of the model's reply (it may wrap it in a code fence). */
export function parseDecision(text: string): Decision | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const r = Decision.safeParse(JSON.parse(text.slice(start, end + 1)));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

// The only money and percentage figures the Opener may state (offer facts in the prompt).
const ALLOWED_FIGURES = new Set(["$299", "$799", "$1,999", "$9,500", "$40", "$99", "12%", "100%"]);

/**
 * Last line of defence: anything the model wants to send that breaks a hard
 * rule is turned into a draft for Dr. Martin instead.
 */
export function enforce(d: Decision): Decision {
  const draft = (why: string): Decision => ({ ...d, action: "draft_for_jabari", reason: `${why}. ${d.reason}`.trim() });
  if (d.action !== "send") return d;
  if (d.audience === "patient") return { ...d, action: "escalate", messages: [], reason: "Model classified a patient; patients only get fixed templates" };
  if (d.messages.length === 0 || d.messages.length > 3) return draft("Unexpected number of messages");
  if (d.messages.some((m) => m.length > 640)) return draft("Message too long");
  const figures = d.messages.join(" ").match(/\$[\d,]+(\.\d+)?|\d+(\.\d+)?%/g) ?? [];
  const bad = figures.filter((f) => !ALLOWED_FIGURES.has(f));
  if (bad.length) return draft(`Unapproved figure(s) ${bad.join(", ")}`);
  if (/\bguarantee/i.test(d.messages.join(" ")) && d.audience !== "practice") return draft("Guarantee mentioned outside a practice conversation");
  return d;
}

export async function decide(event: Incoming, fetcher: typeof fetch = fetch): Promise<Decision | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.OPENER_MODEL || "claude-sonnet-5-5",
      max_tokens: 800,
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `Platform: ${event.platform} (${event.kind === "comment" ? "a comment on our post" : "a direct message"}).\nThread so far (latest message only; earlier history is not available yet):\n${event.text}\n\nReply with the JSON object only.`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const d = parseDecision(text);
  return d ? enforce(d) : null;
}
