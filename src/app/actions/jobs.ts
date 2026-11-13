"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePractice, requireVerifiedClinician } from "@/lib/session";
import { PROFESSIONS, STATES } from "@/lib/labels";
import { onJobPosted, safely } from "@/lib/automation/jobs";
import { locumsAllowed } from "@/lib/markets";

export type JobState = { error?: string } | undefined;

const jobSchema = z.object({
  type: z.enum(["LOCUMS", "PERMANENT", "PER_DIEM"]),
  profession: z.enum(Object.keys(PROFESSIONS) as [string, ...string[]]),
  title: z.string().trim().min(5, "Add a job title").max(140),
  city: z.string().trim().min(2, "Enter the city"),
  state: z.enum(STATES as [string, ...string[]]),
  description: z.string().trim().min(20, "Describe the role in a sentence or two").max(4000),
  payMin: z.coerce.number().positive("Enter the pay"),
  payMax: z.coerce.number().positive("Enter the pay"),
});

export async function postJob(_: JobState, form: FormData): Promise<JobState> {
  const { practice } = await requirePractice();
  const parsed = jobSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.payMax < d.payMin) return { error: "The top of the pay range must be at least the bottom" };
  if (d.type === "LOCUMS" && !locumsAllowed(d.state))
    return { error: "Locums isn't open in that state yet. You can post it as permanent or per diem." };
  const payUnit = d.type === "PERMANENT" ? "YEAR" : "HOUR";
  const job = await db.job.create({
    data: {
      practiceId: practice.id,
      type: d.type,
      profession: d.profession,
      title: d.title,
      city: d.city,
      state: d.state,
      description: d.description,
      payUnit,
      payMinCents: Math.round(d.payMin * 100),
      payMaxCents: Math.round(d.payMax * 100),
    },
  });
  // Alert every verified clinician whose profession and license state fit.
  await safely(onJobPosted(job.id));
  revalidatePath("/practice");
  revalidatePath("/jobs");
  redirect("/practice");
}

export async function apply(form: FormData) {
  const user = await requireVerifiedClinician();
  const jobId = String(form.get("jobId"));
  const job = await db.job.findFirst({ where: { id: jobId, status: "OPEN" } });
  if (!job) return;
  await db.application.upsert({
    where: { jobId_clinicianId: { jobId, clinicianId: user.clinician.id } },
    update: {},
    create: { jobId, clinicianId: user.clinician.id },
  });
  revalidatePath("/jobs");
}

const NEXT: Record<string, string> = { NEW: "INTERVIEW", INTERVIEW: "OFFER", OFFER: "HIRED" };

export async function advance(form: FormData) {
  const { practice } = await requirePractice();
  const id = String(form.get("applicationId"));
  const decline = form.get("decline") === "1";
  const app = await db.application.findFirst({ where: { id, job: { practiceId: practice.id } } });
  if (!app) return;
  const stage = decline ? "DECLINED" : NEXT[app.stage];
  if (!stage) return;
  await db.application.update({ where: { id }, data: { stage } });
  revalidatePath("/practice");
}
