import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { PROFESSIONS } from "@/lib/labels";
import { dollars } from "@/lib/fees";
import { insuranceStatus, lastVerified, summarize } from "@/lib/reviews";
import { appUrl } from "@/lib/email";
import BookForm from "./BookForm";
import { smsEnabled } from "@/lib/sms";

export const dynamic = "force-dynamic";

export default async function Clinician({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ slot?: string }> }) {
  const { id } = await params;
  const { slot } = await searchParams;
  const p = await db.clinicianProfile.findFirst({
    where: { id, bookable: true, status: "VERIFIED" },
    include: {
      user: { select: { name: true } },
      slots: { where: { status: "OPEN", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 40 },
      checks: { where: { result: "MATCH" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      reviews: { where: { status: { in: ["SHOWN", "REPORTED"] } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) notFound();
  // Reported reviews stay visible until an admin decides; nothing is hidden for being negative.
  const rating = summarize(p.reviews.map((r) => r.rating));
  const ins = insuranceStatus(p.insuranceConfirmedAt);
  const checked = lastVerified(p.verifiedAt, p.checks);
  // Structured data so search engines and AI assistants read the profile
  // correctly. It carries only what is already public on this page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": p.profession === "PHYSICIAN" ? "Physician" : "MedicalBusiness",
    name: p.user.name,
    description: `${PROFESSIONS[p.profession]}, ${p.specialty}`,
    url: appUrl(`/find/${p.id}`),
    isAcceptingNewPatients: p.slots.length > 0,
    address: { "@type": "PostalAddress", streetAddress: p.officeAddress, addressLocality: p.officeCity, addressRegion: p.officeState, addressCountry: "US" },
    ...(rating.count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5, worstRating: 1 } } : {}),
  };
  const slots = p.slots.map((s) => ({
    id: s.id,
    day: fmtSlot(s.startsAt, p.officeState, "day"),
    time: fmtSlot(s.startsAt, p.officeState, "time"),
  }));
  return (
    <div className="flex flex-wrap gap-6 items-start">
      <section className="flex-[1_1_320px] card flex flex-col gap-2">
        <h1 className="font-display font-extrabold text-2xl">{p.user.name}</h1>
        <span className="text-muted">{PROFESSIONS[p.profession]} · {p.specialty}</span>
        <span className="font-semibold text-brand text-sm">ID, license and board verified</span>
        {checked && <span className="text-xs text-muted">Last checked {checked.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}. We re-check every license every 90 days.</span>}
        {rating.count > 0 ? (
          <a href="#reviews" className="text-sm"><strong>{rating.average} of 5</strong> from {rating.count} verified patient{rating.count > 1 ? "s" : ""}</a>
        ) : <span className="text-sm text-muted">No reviews yet</span>}
        {p.bio && <p className="text-ink-2 whitespace-pre-wrap">{p.bio}</p>}
        <div className="text-sm border-t border-line pt-3 mt-2 flex flex-col gap-1">
          <span><strong>{p.officeName}</strong></span>
          <span>{p.officeAddress}, {p.officeCity}, {p.officeState}</span>
          <span>{p.insurance ? `Accepts ${p.insurance}` : "Ask the office about insurance"}</span>
          {p.insurance && <span className={`text-xs ${ins.fresh ? "text-brand" : "text-warn"}`}>{ins.label}</span>}
          {p.selfPayCents && <span>Self-pay visit {dollars(p.selfPayCents)}</span>}
          <span>Visits are {p.visitMinutes} minutes</span>
        </div>
      </section>
      <section className="flex-[2_1_420px] card flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Book a visit</h2>
        {slots.length === 0 ? <p className="text-muted">No open times right now. Check back soon.</p> : <BookForm slots={slots} initial={slot} texts={smsEnabled()} />}
      </section>
      <section id="reviews" className="flex-[1_1_100%] card flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Reviews from verified patients</h2>
        <p className="text-sm text-muted">Only patients who booked here and completed a visit can review. We publish every review, good or bad, and never pay for reviews. Payments never change ratings or search order.</p>
        {rating.count === 0 && <p className="text-muted">No reviews yet.</p>}
        {rating.count > 0 && (
          <div className="flex flex-col gap-1 text-sm max-w-xs">
            {rating.histogram.map((n, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-12">{5 - i} star</span>
                <span className="flex-1 h-2 rounded bg-line overflow-hidden"><span className="block h-2 bg-brand" style={{ width: `${(n / rating.count) * 100}%` }} /></span>
                <span className="w-6 text-right text-muted">{n}</span>
              </div>
            ))}
          </div>
        )}
        {p.reviews.map((r) => (
          <article key={r.id} className="border-t border-line pt-3 flex flex-col gap-1">
            <span aria-label={`${r.rating} of 5 stars`} className="text-brand">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span>
            <span className="text-sm text-muted">Verified patient · {r.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}{r.updatedAt.getTime() - r.createdAt.getTime() > 60_000 ? " · edited" : ""}</span>
            {r.body && <p className="text-ink-2 whitespace-pre-wrap">{r.body}</p>}
            {r.reply && <p className="text-sm bg-brand-soft rounded-xl p-3"><strong>Reply from {p.user.name}:</strong> {r.reply}</p>}
          </article>
        ))}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </div>
  );
}
