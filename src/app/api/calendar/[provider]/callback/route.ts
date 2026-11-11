// Google or Microsoft sends the clinician back here after they grant access.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerifiedClinician } from "@/lib/session";
import { calendarEnabled, encryptToken, exchangeCode, parseProvider, readState } from "@/lib/calendar";
import { syncClinicianCalendars } from "@/lib/calendar-sync";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const user = await requireVerifiedClinician();
  const p = parseProvider((await params).provider);
  const q = new URL(req.url).searchParams;
  const code = q.get("code");
  const stateId = readState(q.get("state") ?? "");
  // The state must be one we signed for this same clinician in the last 15 minutes.
  if (!p || !calendarEnabled(p) || !code || stateId !== user.clinician.id) return NextResponse.redirect(appUrl("/schedule?calendar=failed"));
  try {
    const refresh = await exchangeCode(p, code, appUrl(""));
    await db.calendarLink.upsert({
      where: { clinicianId_provider: { clinicianId: user.clinician.id, provider: p } },
      create: { clinicianId: user.clinician.id, provider: p, refreshTokenEnc: encryptToken(refresh) },
      update: { refreshTokenEnc: encryptToken(refresh), error: null },
    });
    await syncClinicianCalendars(user.clinician.id);
  } catch (e) {
    console.error("[calendar] link failed", (e as Error).message);
    return NextResponse.redirect(appUrl("/schedule?calendar=failed"));
  }
  return NextResponse.redirect(appUrl("/schedule?calendar=linked"));
}
