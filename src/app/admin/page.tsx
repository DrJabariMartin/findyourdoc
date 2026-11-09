import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { decide, releasePost } from "../actions/admin";
import { PROFESSIONS } from "@/lib/labels";

export default async function Admin() {
  await requireAdmin();
  const [pending, flagged, due] = await Promise.all([
    db.clinicianProfile.findMany({ where: { status: "PENDING" }, include: { user: true, credentials: { include: { documents: true } } }, orderBy: { createdAt: "asc" } }),
    db.post.findMany({ where: { flagged: true }, include: { room: true }, orderBy: { createdAt: "asc" } }),
    db.clinicianProfile.count({ where: { status: "VERIFIED", nextRecheckAt: { lte: new Date() } } }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="h1">Verification queue</h1>
      <p className="text-ink-2">
        Check each person against the state board&apos;s primary source, their photo ID and their school before approving.
        An NPI alone does not prove a license. {due > 0 && <strong>{due} verified members are due for their 90-day re-check.</strong>}
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">New members ({pending.length})</h2>
        {pending.length === 0 && <p className="text-muted">Nobody waiting.</p>}
        {pending.map((c) => (
          <div key={c.id} className="card flex flex-wrap gap-4 items-center justify-between">
            <div>
              <div className="font-semibold">{c.user.name} · {PROFESSIONS[c.profession]}, {c.specialty}</div>
              <div className="text-sm text-muted">{c.licenseState} license {c.licenseNumber}{c.npi ? ` · NPI ${c.npi}` : " · no NPI given"} · {c.user.email}</div>
              {c.credentials.flatMap((cr) => cr.documents.map((d) => (
                <a key={d.id} href={`/documents/${d.id}`} className="text-sm block" target="_blank" rel="noopener">{cr.kind}: {d.fileName}</a>
              )))}
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
