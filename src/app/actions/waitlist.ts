"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { STATES } from "@/lib/labels";

export type WaitlistState = { error?: string; done?: boolean } | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["PATIENT", "CLINICIAN", "PRACTICE"]),
  state: z.enum(STATES as [string, ...string[]], { errorMap: () => ({ message: "Choose a state" }) }),
  city: z.string().trim().max(80).optional(),
  depositIntent: z.literal("yes").optional(),
});

export async function joinWaitlist(_: WaitlistState, form: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const depositIntent = d.role === "PRACTICE" && d.depositIntent === "yes";
  await db.waitlistEntry.upsert({
    where: { email_role_state: { email: d.email, role: d.role, state: d.state } },
    create: { email: d.email, role: d.role, state: d.state, city: d.city || null, depositIntent },
    update: { city: d.city || null, depositIntent },
  });
  return { done: true };
}
