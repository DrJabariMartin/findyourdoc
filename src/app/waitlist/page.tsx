import WaitlistForm from "./WaitlistForm";
import { depositLink } from "@/lib/deposit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Waitlist · FindYourDoc" };

export default async function Waitlist({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const as = one("as");
  // Ad tags from the link (for example a Meta lead form thank-you screen). Never kept for patients.
  const tags = { utm_source: one("utm_source"), utm_campaign: one("utm_campaign"), utm_content: one("utm_content") };
  return (
    <div className="max-w-xl flex flex-col gap-5">
      <div>
        <h1 className="h1">Bring FindYourDoc to your state</h1>
        <p className="text-ink-2 mt-1">
          We open one state at a time, so every clinician can be verified properly and every practice has real people to hire.
          Tell us where you are. The states with the most patients, clinicians and practices waiting open next.
        </p>
      </div>
      <WaitlistForm initialRole={as.toUpperCase()} depositsLive={depositLink(process.env) !== null} tags={tags} />
    </div>
  );
}
