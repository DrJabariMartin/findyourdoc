import WaitlistForm from "./WaitlistForm";

export const metadata = { title: "Waitlist · FindYourDoc" };

export default async function Waitlist({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  return (
    <div className="max-w-xl flex flex-col gap-5">
      <div>
        <h1 className="h1">Bring FindYourDoc to your state</h1>
        <p className="text-ink-2 mt-1">
          We open one state at a time, so every clinician can be verified properly and every practice has real people to hire.
          Tell us where you are. The states with the most patients, clinicians and practices waiting open next.
        </p>
      </div>
      <WaitlistForm initialRole={(as ?? "").toUpperCase()} />
    </div>
  );
}
