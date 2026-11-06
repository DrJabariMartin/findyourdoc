import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { decide, releasePost } from "../actions/admin";
import { PROFESSIONS } from "@/lib/labels";

export default async function Admin() {
  await requireAdmin();
  const [pending, flagged, due, runs, outbox] = await Promise.all([
    db.clinicianProfile.findMany({
      where: {
        OR: [{ status: { in: ["PENDING", "LAPSED"] } }, { status: "VERIFIED", nextRecheckAt: { lte: new Date() } }],
      },
      include: { user: true, checks: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "asc" },
    }),
    db.post.findMany({ where: { flagged: true }, include: { room: true }, orderBy: { createdAt: "asc" } }),
    db.clinicianProfile.count({ where: { status: "VERIFIED", nextRecheckAt: { lte: new Date() } } }),
    db.automationRun.findMany({ orderBy: { startedAt: "desc" }, take: 14 }),
    db.notification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const outboxCount = (status: string) => outbox.find((o) => o.status === status)?._count._all ?? 0;
  return (
    <div className="flex flex-col gap-8">
      <h1 className="h1">Verification queue</h1>
      <p className="text-ink-2">
        Check each person against the state board&apos;s primary source, their photo ID and their school before approving.
        An NPI alone does not prove a license. {due > 0 && <strong>{due} verified members are due for their 90-day re-check.</strong>}
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Members needing a person ({pending.length})</h2>
        {pending.length === 0 && <p className="text-muted">Nobody waiting.</p>}
        {pending.map((c) => (
          <div key={c.id} className="card flex flex-wrap gap-4 items-center justify-between">
            <div>
              <div className="font-semibold">{c.user.name} · {PROFESSIONS[c.profession]}, {c.specialty}</div>
              <div className="text-sm text-muted">{c.licenseState} license {c.licenseNumber}{c.npi ? ` · NPI ${c.npi}` : " · no NPI given"} · {c.user.email}</div>
              {c.status === "LAPSED" && <div className="text-sm font-semibold">Paused by the 90-day re-check</div>}
              {c.status === "VERIFIED" && <div className="text-sm font-semibold">Due for a manual 90-day re-check (approve renews it)</div>}
              <AutoCheck check={c.checks[0]} />
            </div>
            <form action={decide} className="flex gap-2">
              <input type="hidden" name="clinicianId" value={c.id} />
              <button name="verdict" value="approve" className="btn !py-2">Approve</button>
              <button name="verdict" value="reject" className="btn-soft">Reject</button>
            </form>
          </div>
        ))}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Automations</h2>
        <p className="text-sm text-muted">
          Emails: {outboxCount("PENDING")} queued, {outboxCount("SENT")} sent, {outboxCount("FAILED")} failed.
          Jobs run on a schedule through <code>/api/automations</code>; see the README.
        </p>
        {runs.length === 0 && <p className="text-muted">No runs yet.</p>}
        <ul className="text-sm flex flex-col gap-1">
          {runs.map((r) => (
            <li key={r.id}>
              <span className={r.ok ? "" : "font-semibold"}>{r.ok ? "OK" : "Failed"}</span> · {r.job} · {r.summary} ·{" "}
              <span className="text-muted">{r.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Posts held by the identifier check ({flagged.length})</h2>
        {flagged.map((p) => (
          <div key={p.id} className="card flex flex-col gap-2">
            <div className="text-sm text-muted">{p.room.name}</div>
            <div className="font-semibold">{p.title}</div>
            <p className="text-ink-2 whitespace-pre-wrap">{p.body}</p>
            <form action={releasePost} className="flex gap-2">
              <input type="hidden" name="postId" value={p.id} />
              <button name="verdict" value="release" className="btn !py-2">Publish</button>
              <button name="verdict" value="remove" className="btn-soft">Remove</button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}

const CHECK_LABEL: Record<string, string> = {
  MATCH: "Registry check passed",
  MISMATCH: "Registry check found differences",
  NOT_FOUND: "NPI not found in the registry",
  NO_NPI: "No NPI to check",
  ERROR: "Registry check failed to run",
};

/** The automated NPPES result. It advises; a person still decides. */
function AutoCheck({ check }: { check?: { result: string; issues: string; createdAt: Date } }) {
  if (!check) return <div className="text-sm text-muted">Registry check not run yet</div>;
  return (
    <div className="text-sm mt-1">
      <span className={check.result === "MATCH" ? "" : "font-semibold"}>{CHECK_LABEL[check.result] ?? check.result}</span>
      {check.issues && (
        <ul className="list-disc ml-5 text-ink-2">
          {check.issues.split("\n").map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
