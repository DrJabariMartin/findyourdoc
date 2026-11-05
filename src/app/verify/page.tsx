import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

const KIND: Record<string, string> = {
  ID: "Government photo ID", LICENSE: "State license (primary source)", BOARD: "Board certification",
  EDUCATION: "Degree from an accredited school", MALPRACTICE: "Malpractice history", DEA: "DEA registration", CASE_LOGS: "Case logs",
};
const STATUS: Record<string, string> = { VERIFIED: "Verified", PENDING: "Checking", NEEDED: "Upload needed", EXPIRED: "Expired" };

export default async function Verify() {
  const user = await requireUser();
  if (!user.clinician) redirect("/");
  const creds = await db.credential.findMany({ where: { clinicianId: user.clinician.id } });
  const done = creds.filter((c) => c.status === "VERIFIED").length;
  const s = user.clinician.status;
  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <h1 className="h1">Your credential wallet</h1>
      <p className="text-ink-2">
        {s === "VERIFIED"
          ? `You're verified. We re-check your license and board status every 90 days${user.clinician.nextRecheckAt ? `, next on ${user.clinician.nextRecheckAt.toLocaleDateString("en-US")}` : ""}.`
          : s === "REJECTED"
            ? "We couldn't verify your details. Our team will email you with what's missing."
            : "A verification specialist reviews every new member, usually within 2 business days. The Lounge and job applications open once you're verified."}
      </p>
      <div className="card flex flex-col">
        {creds.map((c) => (
          <div key={c.id} className="flex justify-between py-3 border-t border-line first:border-t-0">
            <span>{KIND[c.kind] ?? c.kind}</span>
            <span className={c.status === "VERIFIED" ? "font-semibold text-brand" : "font-semibold text-warn"}>{STATUS[c.status] ?? c.status}</span>
          </div>
        ))}
        <p className="text-sm text-muted pt-3">{done} of {creds.length} ready. Document upload arrives in the next release; for now our team collects documents by secure email.</p>
      </div>
    </div>
  );
}
