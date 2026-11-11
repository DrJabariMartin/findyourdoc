import Link from "next/link";
import Calculator from "./Calculator";

export const metadata = { title: "Empty provider slot calculator · FindYourDoc" };

export default function CalculatorPage() {
  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <div>
        <h1 className="h1">What does an empty provider slot cost your practice?</h1>
        <p className="text-ink-2 mt-1">
          Two minutes, your own numbers. Visits per day, times what you collect per visit, times clinic days in a month.
        </p>
      </div>
      <Calculator />
      <div className="card flex flex-col gap-3">
        <h2 className="font-semibold">Then compare the ways to fill it</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted"><th className="py-2 pr-4">Option</th><th className="pr-4">What you pay</th><th>What you see</th></tr></thead>
          <tbody>
            <tr className="border-t border-line"><td className="py-2 pr-4 font-semibold">Contingency recruiter</td><td className="pr-4">Often a percentage of first-year salary (ask yours for the exact figure)</td><td>Usually not the candidate&apos;s full market options</td></tr>
            <tr className="border-t border-line"><td className="py-2 pr-4 font-semibold">Locums agency</td><td className="pr-4">The agency&apos;s markup on the clinician&apos;s rate (ask for the bill rate and pay rate)</td><td>Often only the bill rate</td></tr>
            <tr className="border-t border-line"><td className="py-2 pr-4 font-semibold">FindYourDoc</td><td className="pr-4">$299, $799 or $1,999 (Concierge, done for you) a month, plus $9,500 flat only if you hire, or 12% on top of a locums clinician&apos;s rate</td><td>The clinician&apos;s pay, the bill rate and our fee on every listing</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        Want a second set of eyes on your numbers?{" "}
        <Link href="/waitlist?as=practice" className="underline">Join as a practice</Link> and we&apos;ll set up a free 20-minute hiring-needs call. If we can&apos;t help, we&apos;ll tell you.
      </p>
    </div>
  );
}
