import { requirePractice } from "@/lib/session";
import JobForm from "./JobForm";

export default async function NewJob() {
  await requirePractice();
  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <h1 className="h1">Post a role</h1>
      <p className="text-ink-2">For locums and per diem, enter what the clinician takes home per hour. We add 12% on top, and the listing shows all three numbers. For permanent roles, enter the annual base salary range.</p>
      <JobForm />
    </div>
  );
}
