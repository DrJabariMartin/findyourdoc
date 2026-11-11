import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/team";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.practiceInvite.findUnique({ where: { tokenHash: hashInviteToken(token) }, include: { practice: true } });
  const valid = inv && !inv.acceptedAt && inv.expiresAt > new Date();
  return (
    <div className="max-w-md flex flex-col gap-6">
      {valid ? (
        <>
          <h1 className="h1">Join {inv.practice.name}</h1>
          <p className="text-ink-2">You&apos;ve been added to {inv.practice.name}&apos;s hiring team. Set up your account for {inv.email}.</p>
          <JoinForm token={token} />
        </>
      ) : (
        <>
          <h1 className="h1">This invite has expired</h1>
          <p className="text-ink-2">Invites last 7 days and work once. Ask your practice to send a new one.</p>
        </>
      )}
    </div>
  );
}
