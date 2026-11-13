import ResetForm from "./ResetForm";

export const metadata = { robots: { index: false, follow: false } };

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="max-w-md flex flex-col gap-6">
      <h1 className="h1">Choose a new password</h1>
      <ResetForm token={token} />
    </div>
  );
}
