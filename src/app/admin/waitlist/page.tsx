import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { rankWaitlistStates } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export default async function WaitlistAdmin() {
  await requireAdmin();
  const groups = await db.waitlistEntry.groupBy({
    by: ["state", "role", "depositIntent"],
    _count: { _all: true },
  });
  const rows = rankWaitlistStates(groups.map((g) => ({ state: g.state, role: g.role, depositIntent: g.depositIntent, count: g._count._all })));
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="h1">Waitlist by state</h1>
        <p className="text-ink-2 mt-1">Ranked by practices willing to put down a deposit, then all practices, then clinicians. A state opens at 300 verified clinicians and 30 paying practices in the current one.</p>
      </div>
      {rows.length === 0 && <p className="text-muted">Nobody on the waitlist yet.</p>}
      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-2 pr-4">State</th><th className="pr-4">Practices (would pay deposit)</th><th className="pr-4">Clinicians</th><th>Patients</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.state} className="border-t border-line">
                  <td className="py-2 pr-4 font-semibold">{r.state}</td>
                  <td className="pr-4">{r.practices} ({r.depositPractices})</td>
                  <td className="pr-4">{r.clinicians}</td>
                  <td>{r.patients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
