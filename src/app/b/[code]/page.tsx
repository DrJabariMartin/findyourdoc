import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isBookingCode } from "@/lib/booking-link";

export const dynamic = "force-dynamic";

// A practice's own booking link. It opens the clinician's booking page and
// marks the visit as the practice's own patient, so no booking fee applies.
export default async function PracticeLink({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isBookingCode(code)) notFound();
  const c = await db.clinicianProfile.findUnique({ where: { bookingCode: code }, select: { id: true } });
  if (!c) notFound();
  redirect(`/find/${c.id}?ref=${encodeURIComponent(code)}`);
}
