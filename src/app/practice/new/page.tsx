import { requirePractice } from "@/lib/session";
import JobForm from "./JobForm";

export default async function NewJob() {
  const { practice } = await requirePractice();
  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <h1 className="h1">Post a role</h1>
      <p className="text-ink-2">Locums and per diem: enter the clinician&apos;s hourly pay. We add 12% on top. The listing shows your cost, their pay and our fee. Permanent: enter the base salary.</p>
      <JobForm city={practice.city} state={practice.state} />
    </div>
  );
}
