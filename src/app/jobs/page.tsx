import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { listingMoney } from "@/lib/fees";
import { JOB_TYPES, PROFESSIONS } from "@/lib/labels";
import { apply } from "../actions/jobs";

export const dynamic = "force-dynamic";

export default async function Jobs({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const user = await currentUser();
  const verified = user?.clinician?.status === "VERIFIED";
  const jobs = await db.job.findMany({
    where: { status: "OPEN", ...(type && JOB_TYPES[type] ? { type } : {}) },
    include: { practice: true, applications: verified ? { where: { clinicianId: user!.clinician!.id } } : false },
    orderBy: { createdAt: "desc" },
  });
  const pill = (t: string | undefined, label: string) => (
    <Link key={label} href={t ? `/jobs?type=${t}` : "/jobs"} aria-current={type === t ? "true" : undefined}
      className={`text-sm font-semibold px-4 py-2.5 rounded-full border ${type === t ? "bg-brand text-white border-brand" : "bg-white border-field"}`}>{label}</Link>
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="h1">Jobs and locums</h1>
      <p className="text-ink-2">Every listing shows what the practice pays, what you take home, and our fee. No recruiter calls unless you ask. No non-competes.</p>
      <div className="flex flex-wrap gap-2">{pill(undefined, "All")}{Object.entries(JOB_TYPES).map(([k, v]) => pill(k, v))}</div>
      {!verified && <p className="text-sm text-muted">{user ? "Applications open once you're verified." : "Join free and get verified to apply."}</p>}
      {jobs.length === 0 && <p className="text-muted">No openings yet.</p>}
      {jobs.map((j) => {
        const m = listingMoney(j);
        const applied = Array.isArray(j.applications) && j.applications.length > 0;
        return (
          <article key={j.id} id={j.id} className="card flex flex-col gap-3 scroll-mt-20">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h2 className="font-semibold text-lg">{j.title}</h2>
                <span className="text-sm text-muted">{j.practice.name} · {j.city}, {j.state}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap"><span className="pill">{JOB_TYPES[j.type]}</span><span className="pill !bg-[#EEF2F5] !text-ink-2">{PROFESSIONS[j.profession]}</span></div>
            </div>
            <div className="grid sm:grid-cols-3 gap-2 bg-page rounded-xl p-3">
              <div className="flex flex-col"><span className="text-xs text-muted">Practice pays</span><span className="font-semibold">{m.practicePays}</span></div>
              <div className="flex flex-col"><span className="text-xs text-muted">You take home</span><span className="font-bold text-brand">{m.youTakeHome}</span></div>
              <div className="flex flex-col"><span className="text-xs text-muted">FindYourDoc fee</span><span className="font-semibold">{m.ourFee}</span></div>
            </div>
            <p className="text-ink-2 whitespace-pre-wrap">{j.description}</p>
            {verified && (
              <form action={apply}>
                <input type="hidden" name="jobId" value={j.id} />
                <button className={applied ? "btn-soft" : "btn"} disabled={applied}>{applied ? "Credential packet sent" : "Apply with credential packet"}</button>
              </form>
            )}
          </article>
        );
      })}
    </div>
  );
}
