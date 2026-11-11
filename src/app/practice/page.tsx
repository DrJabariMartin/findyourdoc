import Link from "next/link";
import { db } from "@/lib/db";
import { requirePractice } from "@/lib/session";
import { listingMoney } from "@/lib/fees";
import { JOB_TYPES, PROFESSIONS } from "@/lib/labels";
import { advance } from "../actions/jobs";
import { medianResponseHours, responseLabel } from "@/lib/hiring";
import { revokeInvite } from "../actions/team";
import { seatLimit } from "@/lib/team";
import TeamForm, { ClinicianInviteForm } from "./TeamForm";

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
  const response = responseLabel(medianResponseHours(jobs.flatMap((j) => j.applications)));
  const [team, invites, cInvites] = await Promise.all([
    db.practiceMember.findMany({ where: { practiceId: practice.id }, include: { user: { select: { name: true, email: true } } } }),
    db.practiceInvite.findMany({ where: { practiceId: practice.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    db.clinicianInvite.findMany({ where: { practiceId: practice.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
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
        <div className="card"><div className="text-sm text-muted">Verified applicants</div><div className="font-display font-extrabold text-3xl">{applicants}</div><div className="text-xs text-muted mt-1">Clinicians see: {response}</div></div>
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
                    <Link href={`/applications/${a.id}`} className="font-semibold underline">{a.clinician.user.name}, {a.clinician.specialty}</Link>
                    <span className="text-sm text-muted">{a.clinician.licenseState} license verified · {ready} of {a.clinician.credentials.length} credentials ready{a.shareDocs ? " · documents shared for credentialing" : ""}</span>
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
      <section className="card flex flex-col gap-3" aria-labelledby="team">
        <h2 id="team" className="font-semibold text-lg">Your team</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {team.map((m) => <li key={m.id}><strong>{m.user.name}</strong> <span className="text-muted">· {m.user.email}</span></li>)}
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap gap-2 items-center">
              <span>{i.email} <span className="text-muted">· invited, expires {i.expiresAt.toLocaleDateString("en-US")}</span></span>
              <form action={revokeInvite}><input type="hidden" name="inviteId" value={i.id} /><button className="text-sm underline text-muted cursor-pointer">Cancel</button></form>
            </li>
          ))}
        </ul>
        {team.length + invites.length < seatLimit(practice.plan)
          ? <TeamForm />
          : <p className="text-sm text-muted">Your Solo plan includes one admin. <a href="/pricing" className="underline">Group</a> adds your whole team.</p>}
      </section>
      <section className="card flex flex-col gap-3" aria-labelledby="your-clinicians">
        <h2 id="your-clinicians" className="font-semibold text-lg">Bring your clinicians</h2>
        <p className="text-sm text-muted">Invite the clinicians who already work with you so patients can book them here. Add their NPI and we fill in their sign-up from the national registry and your office details; they check it, upload documents, and we verify them.</p>
        <ClinicianInviteForm />
        {cInvites.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {cInvites.map((i) => (
              <li key={i.id}>{i.email} <span className="text-muted">· {i.acceptedAt ? "joined, verification in progress" : i.expiresAt < new Date() ? "invite expired" : `invited, expires ${i.expiresAt.toLocaleDateString("en-US")}`}</span></li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm text-muted">You never see candidates&apos; Lounge posts, anonymous handles or other practices&apos; pay offers.</p>
    </div>
  );
}
