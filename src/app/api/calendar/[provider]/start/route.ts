// Starts linking a clinician's calendar: sends them to Google or Microsoft to
// grant read-only busy-time access.
import { NextResponse } from "next/server";
import { requireVerifiedClinician } from "@/lib/session";
import { authorizeUrl, calendarEnabled, parseProvider, signState } from "@/lib/calendar";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ provider: string }> }) {
  const user = await requireVerifiedClinician();
  const p = parseProvider((await params).provider);
  if (!p || !calendarEnabled(p)) return NextResponse.redirect(appUrl("/schedule?calendar=unavailable"));
  return NextResponse.redirect(authorizeUrl(p, appUrl(""), signState(user.clinician.id)));
}
