// Public availability feed: bookable, verified clinicians and their next open
// times, as JSON. Search engines, AI assistants, health plans and practice
// websites can read it and link patients straight to booking.
//   GET /api/availability?state=MD&profession=PHYSICIAN&specialty=ortho
// Public profile data only. Nothing about patients or booked visits is included.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PROFESSIONS } from "@/lib/labels";
import { appUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

const MAX_CLINICIANS = 200;
const SLOTS_EACH = 5;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const state = q.get("state")?.toUpperCase().slice(0, 2) || undefined;
  const profession = q.get("profession")?.toUpperCase();
  const specialty = q.get("specialty")?.trim().slice(0, 60) || undefined;
  const now = new Date();
  const rows = await db.clinicianProfile.findMany({
    where: {
      status: "VERIFIED",
      bookable: true,
      ...(state ? { officeState: state } : {}),
      ...(profession && profession in PROFESSIONS ? { profession } : {}),
      ...(specialty ? { specialty: { contains: specialty } } : {}),
    },
    include: {
      user: { select: { name: true } },
      slots: { where: { status: "OPEN", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: SLOTS_EACH },
    },
    take: MAX_CLINICIANS,
  });
  const clinicians = rows
    .filter((c) => c.slots.length > 0)
    .map((c) => ({
      name: c.user.name,
      profession: PROFESSIONS[c.profession] ?? c.profession,
      specialty: c.specialty,
      office: { name: c.officeName, city: c.officeCity, state: c.officeState },
      insurance: c.insurance ? c.insurance.split(",").map((s) => s.trim()).filter(Boolean) : [],
      insuranceConfirmedAt: c.insuranceConfirmedAt?.toISOString() ?? null,
      visitMinutes: c.visitMinutes,
      profileUrl: appUrl(`/find/${c.id}`),
      nextOpenTimes: c.slots.map((s) => ({ startsAt: s.startsAt.toISOString(), bookUrl: appUrl(`/find/${c.id}?slot=${s.id}`) })),
    }))
    .sort((a, b) => a.nextOpenTimes[0].startsAt.localeCompare(b.nextOpenTimes[0].startsAt));
  return NextResponse.json(
    { generatedAt: now.toISOString(), count: clinicians.length, clinicians },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300", "Access-Control-Allow-Origin": "*" } },
  );
}
