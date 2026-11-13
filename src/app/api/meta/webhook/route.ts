// Meta webhook for Instagram and Facebook DMs and comments (the AI Opener).
// Set the callback URL to  https://<APP_URL>/api/meta/webhook  in the Meta app,
// with META_VERIFY_TOKEN as the verify token. Off until OPENER_MODE is set.

import { NextResponse } from "next/server";
import { handle } from "@/lib/opener/handle";
import { parseEvents, validSignature } from "@/lib/opener/meta";

export const dynamic = "force-dynamic";

// Meta's subscription handshake.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const results = [];
  for (const event of parseEvents(body)) {
    try {
      const o = await handle(event);
      results.push({ route: o.route, action: o.action });
    } catch (e) {
      // Log the failure only, never the message text.
      console.error(`[opener] ${event.platform} ${event.kind} failed: ${(e as Error).message}`);
      results.push({ route: "error", action: "failed" });
    }
  }
  // Always 200 for a signed request so Meta does not disable the webhook.
  return NextResponse.json({ results });
}
