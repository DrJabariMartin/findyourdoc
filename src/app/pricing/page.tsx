import Link from "next/link";
import {
  PLANS,
  PERMANENT_HIRE_FEE_CENTS,
  BOOKING_FEE_CENTS,
  HIRE_GUARANTEE_DAYS,
  LOCUMS_CANCEL_GUARANTEE_DAYS,
  CONCIERGE_SHORTLIST_DAYS,
  CONCIERGE_SHORTLIST_SIZE,
  dollars,
} from "@/lib/fees";

export const metadata = { title: "Pricing for practices · FindYourDoc" };

const guarantees = [
  ["Permanent hires", `If your hire leaves within ${HIRE_GUARANTEE_DAYS} days for any reason, your next permanent hire through FindYourDoc has no fee.`],
  ["Locums", `If a confirmed locum cancels within ${LOCUMS_CANCEL_GUARANTEE_DAYS} days of the start date, our fee on the replacement is waived.`],
  ["Concierge", `${CONCIERGE_SHORTLIST_SIZE} verified, interested candidates per role within ${CONCIERGE_SHORTLIST_DAYS} days, or that month's Concierge fee is waived.`],
];

// The questions practices ask before they buy, answered before they have to ask.
const objections = [
  ["How is this cheaper than a recruiter?", `A recruited physician typically costs $72,000 to $168,000. Here a permanent hire is ${dollars(PERMANENT_HIRE_FEE_CENTS)} flat, charged only when the clinician signs.`],
  ["We already use an agency.", "Keep it. Post the same role here too. You pay a hire or locums fee only when you hire through FindYourDoc."],
  ["What stops us hiring a locum directly later?", "Nothing. There are no non-competes. The fee to convert a locum to permanent is published and falls every month to $0 after 12 months."],
  ["Are the clinicians real?", "Every clinician passes ID, license, board and education checks, re-checked every 90 days, and a person on our team approves each one."],
  ["My partners need to sign off.", "Send them this page. Every price is here, and nothing is hidden in a contract. We are happy to join a 15-minute call with them."],
  ["What does the clinician actually get paid?", "Every listing shows what you pay, what the clinician takes home and our fee. Locums keep 100% of their rate; our 12% is added on top."],
];

export default function Pricing() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3 max-w-3xl">
        <h1 className="h1">Pricing for practices</h1>
        <p className="text-lg text-ink-2">
          Three plans, one set of fees. Clinicians and patients never pay, and we never take a percentage of anyone&apos;s professional fees.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Plans">
        {PLANS.map((p) => {
          const core = p.id === "GROUP";
          return (
            <div key={p.id} className={`card flex flex-col gap-3 ${core ? "border-brand! border-2" : ""}`}>
              {core && <span className="pill self-start">Most practices choose this</span>}
              <h2 className="font-display font-extrabold text-2xl">{p.name}</h2>
              <div><span className="font-display font-extrabold text-3xl">{dollars(p.monthlyCents)}</span><span className="text-muted"> a month</span></div>
              <p className="text-ink-2">{p.who}</p>
              <ul className="flex flex-col gap-1.5 text-sm list-disc pl-5">
                {p.includes.map((i) => <li key={i}>{i}</li>)}
              </ul>
              <Link href={`/signup?as=practice&plan=${p.id}`} className={`${core ? "btn" : "btn-soft"} mt-auto`}>Start with {p.name}</Link>
            </div>
          );
        })}
      </section>

      <section className="card bg-ink! text-white flex flex-col gap-2">
        <h2 className="font-semibold text-lg">Fees on every plan</h2>
        <ul className="flex flex-col gap-1 text-[#C9D6E0]">
          <li>Permanent hire: {dollars(PERMANENT_HIRE_FEE_CENTS)} flat, only when the clinician signs.</li>
          <li>Locums: 12% on top of the clinician&apos;s rate. The clinician keeps 100% of their rate.</li>
          <li>Patient booking: {dollars(BOOKING_FEE_CENTS)} per completed new-patient visit. Nothing for no-shows, cancellations or your own website&apos;s patients.</li>
          <li>Locum to permanent: the published conversion fee falls to $0 after 12 months. No non-competes.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display font-extrabold text-2xl">Our guarantees</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {guarantees.map(([t, b]) => (
            <div key={t} className="card"><h3 className="font-semibold">{t}</h3><p className="text-ink-2 mt-1 text-sm">{b}</p></div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 max-w-3xl">
        <h2 className="font-display font-extrabold text-2xl">Questions practices ask first</h2>
        {objections.map(([q, a]) => (
          <details key={q} className="card">
            <summary className="font-semibold cursor-pointer">{q}</summary>
            <p className="text-ink-2 mt-2">{a}</p>
          </details>
        ))}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">Not in your state yet? Tell us where you hire, and we&apos;ll open there first when enough practices ask.</p>
        <Link href="/waitlist?as=practice" className="btn-soft">Join the waitlist</Link>
      </section>
    </div>
  );
}
