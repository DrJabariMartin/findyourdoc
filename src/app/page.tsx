import Link from "next/link";

const promises = [
  ["We never sell what you say", "No pharma data deals, no selling conversations, no ad trackers on member pages."],
  ["Pay on every listing", "What the practice pays, what you take home and our fee, before you apply."],
  ["No non-competes", "No stay-or-pay penalties. Conversion to permanent costs a published fee that falls to $0."],
  ["Verified people only", "ID, license, board and education checks, re-checked every 90 days."],
];

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-5 max-w-3xl pt-6">
        <h1 className="font-display font-extrabold text-5xl leading-tight">Find verified care. A safe haven for the people who give it.</h1>
        <p className="text-lg text-ink-2">
          Patients book physicians, nurse practitioners, PAs, physical therapists, pharmacists and more, all
          license-verified and free to book. Clinicians get a private community and jobs that show the real pay.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/find" className="btn">Book care</Link>
          <Link href="/signup" className="btn-soft">Join as a clinician</Link>
          <Link href="/signup?as=practice" className="btn-soft">I&apos;m hiring</Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {promises.map(([t, b]) => (
          <div key={t} className="card">
            <h2 className="font-semibold text-lg">{t}</h2>
            <p className="text-ink-2 mt-1">{b}</p>
          </div>
        ))}
      </section>
      <section className="rounded-2xl bg-ink text-white p-8 flex flex-col gap-3">
        <h2 className="font-display font-extrabold text-2xl">For practices</h2>
        <p className="text-[#C9D6E0]">$299 a month solo, $799 for groups, $1,999 if we run your hiring. $9,500 flat per permanent hire. Locums at 12% on top. Never a percentage of professional fees.</p>
        <p className="text-[#C9D6E0]">Guaranteed: if a permanent hire leaves within 90 days, the next one has no fee.</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/pricing" className="btn">See plans and guarantees</Link>
          <Link href="/waitlist" className="btn-soft">Not in your state yet? Join the waitlist</Link>
        </div>
      </section>
      <footer className="text-sm text-muted">Founded by Dr. Jabari Martin, orthopedic surgeon.</footer>
    </div>
  );
}
