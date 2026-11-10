import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { rankWaitlistStates } from "@/lib/waitlist";
import { leadsByAd } from "@/lib/leads";

export const dynamic = "force-dynamic";

export default async function WaitlistAdmin() {
  await requireAdmin();
  const groups = await db.waitlistEntry.groupBy({
    by: ["state", "role", "depositIntent"],
    _count: { _all: true },
  });
  const practiceLeads = await db.waitlistEntry.findMany({
    where: { role: "PRACTICE" },
    select: { utmSource: true, utmCampaign: true, utmContent: true, depositIntent: true, contactConsent: true },
  });
  const ads = leadsByAd(practiceLeads);
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
      <div>
        <h2 className="text-lg font-semibold">Practice leads by ad</h2>
        <p className="text-ink-2 mt-1">Tagged from the link that brought each practice in (utm_source, utm_campaign, utm_content). Compare with each ad&apos;s spend in Meta to get cost per lead.</p>
      </div>
      {ads.length === 0 && <p className="text-muted">No practice leads yet.</p>}
      {ads.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-2 pr-4">Source</th><th className="pr-4">Campaign</th><th className="pr-4">Ad</th><th className="pr-4">Leads</th><th className="pr-4">OK to call or text</th><th>Would pay deposit</th></tr></thead>
            <tbody>
              {ads.map((a) => (
                <tr key={`${a.source}|${a.campaign}|${a.content}`} className="border-t border-line">
                  <td className="py-2 pr-4 font-semibold">{a.source}</td>
                  <td className="pr-4">{a.campaign}</td>
                  <td className="pr-4">{a.content}</td>
                  <td className="pr-4">{a.leads}</td>
                  <td className="pr-4">{a.canContact}</td>
                  <td>{a.deposit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
