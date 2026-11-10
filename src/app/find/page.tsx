import Link from "next/link";
import { db } from "@/lib/db";
import { fmtSlot } from "@/lib/time";
import { PROFESSIONS } from "@/lib/labels";
import { matchesCare, acceptsInsurance, whoCanHelp, COMMON_NEEDS } from "@/lib/search";
import { dollars } from "@/lib/fees";
import { launchStates, servesState, licensedStates } from "@/lib/market";

type Q = { care?: string; state?: string; city?: string; insurance?: string; profession?: string };

export const dynamic = "force-dynamic";

export default async function Find({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  const care = q.care ?? "";
  const helpers = whoCanHelp(care);
  const now = new Date();
  const launch = launchStates();
  const state = q.state && launch.includes(q.state) ? q.state : undefined;
  const people = await db.clinicianProfile.findMany({
    where: {
      bookable: true,
      status: "VERIFIED",
      ...(q.profession ? { profession: q.profession } : {}),
    },
    include: {
      user: { select: { name: true } },
      licenses: true,
      slots: { where: { status: "OPEN", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 40 },
    },
  });
  const closed = !!q.state && !state; // a state we haven't opened yet: waitlist, no results
  const results = people
    .filter(() => !closed)
    // Only clinicians who can legally see a patient in the launch market (or the chosen state).
    .filter((p) => servesState(p, state, launch, p.slots.some((s) => s.mode === "VIDEO"), now))
    .map((p) => {
      // Video times only for states this clinician is licensed in; in-person times only at an office in the market.
      const licensed = licensedStates(p, now);
      const inPersonOk = !!p.officeState && launch.includes(p.officeState) && licensed.includes(p.officeState) && (!state || state === p.officeState);
      const videoOk = state ? licensed.includes(state) : licensed.some((s) => launch.includes(s));
      const slots = p.slots.filter((s) => (s.mode === "VIDEO" ? videoOk : inPersonOk)).slice(0, 6);
      return { ...p, slots, videoIn: licensed.filter((s) => launch.includes(s)) };
    })
    .filter((p) => matchesCare(care, p))
    .filter((p) => !q.city || (p.officeCity ?? "").toLowerCase().includes(q.city.toLowerCase()))
    .filter((p) => acceptsInsurance(q.insurance ?? "", p.insurance))
    // Ranking: anyone with open times first, then soonest availability. Nothing paid affects order.
    .sort((a, b) => (a.slots[0]?.startsAt.getTime() ?? Infinity) - (b.slots[0]?.startsAt.getTime() ?? Infinity));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="h1">Find care and book</h1>
        <p className="text-ink-2 mt-1">Physicians, nurse practitioners, PAs, physical and occupational therapists, pharmacists and more. Free for patients. Results are ordered by availability, and nobody can pay to rank higher.</p>
      </div>
      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
        <label className="label lg:col-span-2">Care you need<input name="care" defaultValue={care} className="field" placeholder="Knee pain, physical therapy, flu…" /></label>
        <label className="label">Type of clinician
          <select name="profession" defaultValue={q.profession ?? ""} className="field">
            <option value="">Any</option>
            {Object.entries(PROFESSIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="label">City<input name="city" defaultValue={q.city ?? ""} className="field" /></label>
        <label className="label">State
          <select name="state" defaultValue={state ?? ""} className="field">
            <option value="">Any open state</option>
            {launch.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="label">Insurance<input name="insurance" defaultValue={q.insurance ?? ""} className="field" placeholder="Plan name or self-pay" /></label>
        <button className="btn lg:col-start-6">Search</button>
      </form>
      {!care && (
        <nav aria-label="Common needs" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted font-semibold">What do you need help with?</span>
          {COMMON_NEEDS.map((n) => (
            <Link key={n} href={`/find?care=${encodeURIComponent(n)}`} className="pill no-underline">{n}</Link>
          ))}
        </nav>
      )}
      {helpers.length > 0 && (
        <p className="card text-ink-2">
          <strong className="text-ink">Who can help with {care.toLowerCase()}:</strong> {helpers.join(", ")}. The results below are ordered by who can see you soonest.
          This is a guide to finding the right kind of clinician, not medical advice. In an emergency, call 911.
        </p>
      )}
      <p className="text-sm text-muted">
        Booking is open in {launch.join(", ")}. Somewhere else? <Link href="/waitlist?as=patient">Join the waitlist</Link> and we&apos;ll email you once when we open there.
      </p>
      {closed && <p role="status" className="card text-ink-2">We aren&apos;t open in {q.state} yet. <Link href="/waitlist?as=patient">Join the waitlist</Link>.</p>}
      <p className="text-sm text-muted">{results.length} {results.length === 1 ? "clinician" : "clinicians"} found</p>
      {results.map((p) => (
        <article key={p.id} className="card flex flex-wrap gap-x-6 gap-y-4">
          <div className="flex-[1_1_280px] min-w-0 flex flex-col gap-0.5">
            <Link href={`/find/${p.id}`} className="font-semibold text-lg text-ink hover:underline">{p.user.name}</Link>
            <span className="text-sm text-muted">{PROFESSIONS[p.profession]} · {p.specialty}</span>
            <span className="text-sm text-muted">{p.officeName}, {p.officeCity}, {p.officeState}</span>
            {p.slots.some((s) => s.mode === "VIDEO") && <span className="text-sm text-muted">Video visits for patients in {p.videoIn.join(", ")}</span>}
            {p.ownerDisclosure && <span className="text-sm text-muted">{p.ownerDisclosure}</span>}
            <span className="text-sm font-semibold text-brand">License verified{p.nextRecheckAt ? `, re-checked every 90 days` : ""}</span>
            <span className="text-sm text-muted">{p.insurance ? `Accepts ${p.insurance}` : "Insurance: ask the office"}{p.selfPayCents ? ` · Self-pay ${dollars(p.selfPayCents)}` : ""}</span>
          </div>
          <div className="flex-[1_1_320px] flex flex-col gap-2">
            <span className="text-sm font-semibold text-muted">{p.slots.length ? "Next available" : "No open times right now"}</span>
            <div className="flex flex-wrap gap-2">
              {p.slots.map((s) => (
                <Link key={s.id} href={`/find/${p.id}?slot=${s.id}`} className="text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-brand text-brand bg-white hover:bg-brand-soft">
                  {fmtSlot(s.startsAt, state ?? p.officeState)}{s.mode === "VIDEO" ? " · Video" : ""}
                </Link>
              ))}
            </div>
          </div>
        </article>
      ))}
      <p className="bg-brand-soft rounded-xl p-3.5 text-sm text-brand-dark">Every clinician here passed ID, license and board checks. Your booking details go only to the clinician&apos;s office. We never sell patient data and load no ad trackers on these pages.</p>
    </div>
  );
}
