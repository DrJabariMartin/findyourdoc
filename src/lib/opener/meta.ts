// Meta (Instagram and Facebook) webhook helpers: signature check, event
// parsing and the official Send API. Automated replies are only allowed inside
// Meta's 24-hour window after the person's last message, and one private reply
// per comment, which is all this sends.

import { createHmac, timingSafeEqual } from "node:crypto";

export type Incoming = {
  platform: "instagram" | "facebook";
  kind: "dm" | "comment";
  /** The person's id for DMs, the comment id for comments (private replies go to the comment). */
  replyTo: string;
  senderId: string;
  text: string;
};

export function validSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const want = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === want.length && timingSafeEqual(given, want);
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function parseEvents(body: unknown): Incoming[] {
  const b = obj(body);
  const platform = b.object === "instagram" ? "instagram" : b.object === "page" ? "facebook" : null;
  if (!platform) return [];
  const out: Incoming[] = [];
  for (const e of arr(b.entry)) {
    const entry = obj(e);
    const ownId = str(entry.id);
    for (const m of arr(entry.messaging)) {
      const ev = obj(m);
      const message = obj(ev.message);
      const sender = str(obj(ev.sender).id);
      const text = str(message.text);
      // Skip our own echoes and anything without text (stickers, reactions, attachments).
      if (!text || message.is_echo || !sender || sender === ownId) continue;
      out.push({ platform, kind: "dm", replyTo: sender, senderId: sender, text });
    }
    for (const c of arr(entry.changes)) {
      const ch = obj(c);
      const v = obj(ch.value);
      if (platform === "instagram" && ch.field === "comments") {
        const from = str(obj(v.from).id);
        if (from && from !== ownId && str(v.text)) out.push({ platform, kind: "comment", replyTo: str(v.id), senderId: from, text: str(v.text) });
      }
      if (platform === "facebook" && ch.field === "feed" && v.item === "comment" && v.verb === "add") {
        const from = str(obj(v.from).id);
        if (from && from !== ownId && str(v.message)) out.push({ platform, kind: "comment", replyTo: str(v.comment_id), senderId: from, text: str(v.message) });
      }
    }
  }
  return out;
}

export function sendRequest(event: Incoming, text: string) {
  const version = process.env.META_GRAPH_VERSION || "v21.0";
  const recipient = event.kind === "comment" ? { comment_id: event.replyTo } : { id: event.replyTo };
  return {
    url: `https://graph.facebook.com/${version}/me/messages`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.META_PAGE_TOKEN ?? ""}` },
      body: JSON.stringify({ recipient, messaging_type: "RESPONSE", message: { text } }),
    },
  };
}

export async function sendReply(event: Incoming, text: string, fetcher: typeof fetch = fetch): Promise<void> {
  const { url, init } = sendRequest(event, text);
  const res = await fetcher(url, init);
  if (!res.ok) throw new Error(`Meta send failed: ${res.status}`);
}
