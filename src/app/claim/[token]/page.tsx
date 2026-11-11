import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/team";
import ClaimForm from "./ClaimForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Claim({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.clinicianInvite.findUnique({ where: { tokenHash: hashInviteToken(token) }, include: { practice: true } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return (
      <div className="max-w-md flex flex-col gap-4">
        <h1 className="h1">This invite has expired</h1>
        <p className="text-ink-2">Invites last 14 days and work once. Ask the practice to send a new one, or <a href="/signup" className="underline">sign up yourself</a>.</p>
      </div>
    );
  }
  const prefill = JSON.parse(inv.prefill) as Partial<Record<"name" | "profession" | "specialty" | "licenseState" | "licenseNumber", string | null>>;
  return (
    <div className="max-w-xl flex flex-col gap-6">
      <div>
        <h1 className="h1">{inv.practice.name} invited you to FindYourDoc</h1>
        <p className="text-ink-2 mt-1">
          {inv.npi ? "We filled in what the national NPI registry has on file. Check each field, choose a password, and you're on to uploading documents." : "Fill in your details and choose a password, then upload your documents."}
          {" "}A person on our team verifies every clinician before they appear to patients or colleagues.
        </p>
      </div>
      <ClaimForm token={token} email={inv.email} prefill={prefill} />
    </div>
  );
}
