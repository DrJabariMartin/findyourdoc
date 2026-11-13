import SignupForms from "./SignupForms";

export default async function Signup({ searchParams }: { searchParams: Promise<{ as?: string; plan?: string }> }) {
  const { as, plan } = await searchParams;
  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="h1">Join FindYourDoc</h1>
      <SignupForms initial={as === "practice" || plan ? "practice" : "clinician"} plan={plan} />
    </div>
  );
}
