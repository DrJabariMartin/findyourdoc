import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { PROFESSIONS } from "@/lib/labels";
import { dollars } from "@/lib/fees";
import { launchStates, licensedStates, videoStates } from "@/lib/market";
import { isBookingCode } from "@/lib/booking-link";
import BookForm from "./BookForm";

export const dynamic = "force-dynamic";

export default async function Clinician({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ slot?: string; ref?: string }> }) {
  const { id } = await params;
  const { slot, ref } = await searchParams;
  const p = await db.clinicianProfile.findFirst({
    where: { id, bookable: true, status: "VERIFIED" },
    include: {
      user: { select: { name: true } },
      licenses: true,
      slots: { where: { status: "OPEN", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 40 },
    },
  });
  if (!p) notFound();
  const launch = launchStates();
  const video = videoStates(p, launch);
  const inPerson = !!p.officeState && launch.includes(p.officeState) && licensedStates(p).includes(p.officeState);
  // Show only times this clinician can legally offer in the launch market.
  const slots = p.slots.filter((s) => (s.mode === "VIDEO" ? video.length > 0 : inPerson)).map((s) => ({
    id: s.id,
    mode: s.mode,
    day: fmtSlot(s.startsAt, p.officeState, "day"),
    time: fmtSlot(s.startsAt, p.officeState, "time"),
  }));
  return (
    <div className="flex flex-wrap gap-6 items-start">
      <section className="flex-[1_1_320px] card flex flex-col gap-2">
        <h1 className="font-display font-extrabold text-2xl">{p.user.name}</h1>
        <span className="text-muted">{PROFESSIONS[p.profession]} · {p.specialty}</span>
        <span className="font-semibold text-brand text-sm">ID, license and board verified · Licensed in {licensedStates(p).join(", ")}</span>
        {p.ownerDisclosure && <p className="text-sm bg-brand-soft rounded-lg p-2.5 text-brand-dark">{p.ownerDisclosure} Results on FindYourDoc are ordered by availability only, for every practice.</p>}
        {p.bio && <p className="text-ink-2 whitespace-pre-wrap">{p.bio}</p>}
        <div className="text-sm border-t border-line pt-3 mt-2 flex flex-col gap-1">
          <span><strong>{p.officeName}</strong></span>
          <span>{p.officeAddress}, {p.officeCity}, {p.officeState}</span>
          <span>{p.insurance ? `Accepts ${p.insurance}` : "Ask the office about insurance"}</span>
          {p.selfPayCents && <span>Self-pay visit {dollars(p.selfPayCents)}</span>}
          <span>Visits are {p.visitMinutes} minutes</span>
          {video.length > 0 && <span>Video visits for patients located in {video.join(", ")}</span>}
        </div>
      </section>
      <section className="flex-[2_1_420px] card flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Book a visit</h2>
        {slots.length === 0 ? <p className="text-muted">No open times right now. Check back soon.</p> : <BookForm slots={slots} initial={slot} videoStates={video} office={p.officeName ?? "The office"} refCode={isBookingCode(ref) ? ref : undefined} />}
      </section>
    </div>
  );
}
