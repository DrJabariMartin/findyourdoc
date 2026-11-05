import Link from "next/link";
import { db } from "@/lib/db";
import { requirePractice } from "@/lib/session";
import { listingMoney } from "@/lib/fees";
import { JOB_TYPES, PROFESSIONS } from "@/lib/labels";
import { advance } from "../actions/jobs";

export const dynamic = "force-dynamic";

const STAGE: Record<string, string> = { NEW: "New", INTERVIEW: "Interview", OFFER: "Offer sent", HIRED: "Hired", DECLINED: "Declined" };
const VERB: Record<string, string> = { NEW: "Move to interview", INTERVIEW: "Send offer", OFFER: "Mark hired" };

export default async function PracticeDash() {
  const { practice } = await requirePractice();
  const jobs = await db.job.findMany({
    where: { practiceId: practice.id },
    include: { applications: { include: { clinician: { include: { user: { select: { name: true } }, credentials: true } } }, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const applicants = jobs.reduce((n, j) => n + j.applications.length, 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="h1">Hiring dashboard</h1>
          <p className="text-ink-2">{practice.name} · {practice.city}, {practice.state}</p>
        </div>
        <Link href="/practice/new" className="btn">Post a role</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card"><div className="text-sm text-muted">Open roles</div><div className="font-display font-extrabold text-3xl">{jobs.filter((j) => j.status === "OPEN").length}</div></div>
        <div className="card"><div className="text-sm text-muted">Verified applicants</div><div className="font-display font-extrabold text-3xl">{applicants}</div></div>
        <div className="card bg-ink! text-white"><div className="text-sm text-[#C9D6E0]">Your prices</div><div className="text-sm mt-1">$9,500 flat per permanent hire · 12% on top for locums · locum-to-permanent fee falls to $0 after 12 months. No non-competes.</div></div>
      </div>
      {jobs.length === 0 && <p className="text-muted">No roles yet. Post your first one.</p>}
      {jobs.map((j) => {
        const m = listingMoney(j);
        return (
          <section key={j.id} className="card flex flex-col gap-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold text-lg">{j.title}</h2>
              <span className="pill">{JOB_TYPES[j.type]} · {PROFESSIONS[j.profession]}</span>
            </div>
            <p className="text-sm text-muted">You pay {m.practicePays} · clinician takes home {m.youTakeHome} · our fee {m.ourFee}</p>
            {j.applications.length === 0 && <p className="text-sm text-muted">No applicants yet.</p>}
            {j.applications.map((a) => {
              const ready = a.clinician.credentials.filter((c) => c.status === "VERIFIED").length;
              return (
                <div key={a.id} className="flex flex-wrap gap-3 items-center border-t border-line pt-3">
                  <div className="flex-1 min-w-[220px] flex flex-col">
                    <span className="font-semibold">{a.clinician.user.name}, {a.clinician.specialty}</span>
                    <span className="text-sm text-muted">{a.clinician.licenseState} license verified · {ready} of {a.clinician.credentials.length} credentials ready</span>
                  </div>
                  <span className="pill">{STAGE[a.stage]}</span>
                  {VERB[a.stage] && (
                    <form action={advance} className="flex gap-2">
                      <input type="hidden" name="applicationId" value={a.id} />
                      <button className="btn !py-2 text-sm">{VERB[a.stage]}</button>
                      <button name="decline" value="1" className="btn-soft text-sm">Decline</button>
                    </form>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="text-sm text-muted">You never see candidates&apos; Lounge posts, anonymous handles or other practices&apos; pay offers.</p>
    </div>
  );
}
