import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { applicationFor } from "@/lib/applications";
import { CREDENTIAL_LABELS } from "@/lib/labels";
import { setSharing } from "../../actions/jobs";
import MessageForm from "./MessageForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

const STAGE: Record<string, string> = { NEW: "Applied", INTERVIEW: "Interview", OFFER: "Offer sent", HIRED: "Hired", DECLINED: "Declined" };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const found = await applicationFor(user.id, id);
  if (!found) notFound();
  const { a, asPractice } = found;
  const credentials = await db.credential.findMany({
    where: { clinicianId: a.clinicianId },
    include: { documents: { orderBy: { uploadedAt: "desc" }, take: 3 } },
    orderBy: { kind: "asc" },
  });
  const showDocs = !asPractice || a.shareDocs;
  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div>
        <h1 className="h1">{a.job.title}</h1>
        <p className="text-ink-2">{a.job.practice.name} · {a.job.city}, {a.job.state} · {asPractice ? a.clinician.user.name : "Your application"} · <strong>{STAGE[a.stage]}</strong></p>
      </div>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Credential passport</h2>
        <p className="text-sm text-muted">
          {asPractice
            ? a.shareDocs
              ? "This clinician shared their verified documents with your practice for credentialing. Use them only for this hiring decision."
              : "The clinician hasn't shared documents yet. You can see what FindYourDoc has verified below."
            : "Practices see what we've verified. If you share, they can also open your verified documents for credentialing, which can save weeks. You can stop sharing at any time."}
        </p>
        <table className="text-sm">
          <thead><tr className="text-left text-muted"><th className="py-1">Credential</th><th>Status</th><th>Expires</th>{showDocs && <th>Documents</th>}</tr></thead>
          <tbody>
            {credentials.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-1.5">{CREDENTIAL_LABELS[c.kind] ?? c.kind}</td>
                <td>{c.status === "VERIFIED" ? "Verified" : c.status === "EXPIRED" ? "Expired" : "Not yet verified"}</td>
                <td>{c.expiresAt ? c.expiresAt.toLocaleDateString("en-US") : "—"}</td>
                {showDocs && (
                  <td>{(asPractice && c.status !== "VERIFIED") ? "—" : c.documents.map((d) => <a key={d.id} href={`/documents/${d.id}`} className="underline block">{d.fileName}</a>)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!asPractice && (
          <form action={setSharing}>
            <input type="hidden" name="applicationId" value={a.id} />
            <input type="hidden" name="share" value={a.shareDocs ? "off" : "on"} />
            <button className={a.shareDocs ? "btn-soft" : "btn"}>{a.shareDocs ? "Stop sharing documents with this practice" : "Share my verified documents with this practice"}</button>
          </form>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold text-lg">Messages</h2>
        {a.messages.length === 0 && <p className="text-muted text-sm">No messages yet.</p>}
        {a.messages.map((m) => (
          <div key={m.id} className={`rounded-xl p-3 max-w-[85%] ${m.fromPractice === asPractice ? "bg-brand-soft self-end" : "bg-page self-start"}`}>
            <div className="text-xs text-muted">{m.fromPractice ? a.job.practice.name : a.clinician.user.name} · {m.createdAt.toLocaleString("en-US")}</div>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
        <MessageForm applicationId={a.id} />
      </section>
    </div>
  );
}
