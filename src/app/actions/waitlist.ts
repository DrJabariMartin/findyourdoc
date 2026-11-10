"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { STATES } from "@/lib/labels";
import { depositLink } from "@/lib/deposit";
import { adTags, cleanUsPhone } from "@/lib/leads";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";
import { onPracticeLead, safely } from "@/lib/automation/jobs";

export type WaitlistState = { error?: string; done?: boolean; depositUrl?: string } | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["PATIENT", "CLINICIAN", "PRACTICE"]),
  state: z.enum(STATES as [string, ...string[]], { errorMap: () => ({ message: "Choose a state" }) }),
  city: z.string().trim().max(80).optional(),
  depositIntent: z.literal("yes").optional(),
  phone: z.string().trim().max(30).optional(),
  contactConsent: z.literal("yes").optional(),
  utm_source: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
});

export async function joinWaitlist(_: WaitlistState, form: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const isPractice = d.role === "PRACTICE";
  const depositIntent = isPractice && d.depositIntent === "yes";
  // Phone and call/text consent are asked of practices only.
  const phone = isPractice && d.phone ? cleanUsPhone(d.phone) : null;
  if (isPractice && d.phone && !phone) return { error: "Enter a 10-digit US phone number, or leave it blank" };
  const contactConsent = phone !== null && d.contactConsent === "yes";
  if (!hit("waitlist", await clientIp())) return { error: "Too many sign-ups from this connection. Please try again later." };
  const tags = adTags(d.role, d);
  const entry = await db.waitlistEntry.upsert({
    where: { email_role_state: { email: d.email, role: d.role, state: d.state } },
    create: { email: d.email, role: d.role, state: d.state, city: d.city || null, depositIntent, phone, contactConsent, ...tags },
    // Keep the first ad tags: they show which ad brought the lead in.
    update: { city: d.city || null, depositIntent, ...(isPractice ? { phone, contactConsent } : {}) },
  });
  if (isPractice) await safely(onPracticeLead(entry.id));
  // Deposit-ready practices get the payment link straight away, once deposits are on.
  const depositUrl = depositIntent ? depositLink(process.env, d.email) : null;
  return { done: true, ...(depositUrl ? { depositUrl } : {}) };
}
