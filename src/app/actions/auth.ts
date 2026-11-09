"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { startSession, endSession } from "@/lib/session";
import { lookupNpi } from "@/lib/npi";
import { anonLabel, PROFESSIONS, STATES } from "@/lib/labels";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";
import { appUrl, passwordReset, send } from "@/lib/email";
import { createHash, randomBytes } from "node:crypto";

const TOO_MANY = { error: "Too many attempts. Please wait a few minutes and try again." };

export type FormState = { error?: string } | undefined;

const base = {
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters"),
};

const clinicianSchema = z.object({
  ...base,
  profession: z.enum(Object.keys(PROFESSIONS) as [string, ...string[]]),
  specialty: z.string().trim().min(2, "Enter your specialty or practice area"),
  licenseState: z.enum(STATES as [string, ...string[]]),
  licenseNumber: z.string().trim().min(3, "Enter your license number"),
  npi: z.string().trim().regex(/^\d{10}$/, "NPI is 10 digits").optional().or(z.literal("")),
});

const practiceSchema = z.object({
  ...base,
  practiceName: z.string().trim().min(2, "Enter the practice name"),
  city: z.string().trim().min(2, "Enter the city"),
  state: z.enum(STATES as [string, ...string[]]),
});

async function emailTaken(email: string) {
  return (await db.user.findUnique({ where: { email } })) !== null;
}

export async function signupClinician(_: FormState, form: FormData): Promise<FormState> {
  if (!hit("signup", await clientIp())) return TOO_MANY;
  const parsed = clinicianSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await emailTaken(d.email)) return { error: "An account with that email already exists" };
  if (d.npi && (await db.clinicianProfile.findUnique({ where: { npi: d.npi } })))
    return { error: "That NPI is already registered. Contact support if this is you." };

  const npiInfo = d.npi ? await lookupNpi(d.npi) : null;
  const user = await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: "CLINICIAN",
      clinician: {
        create: {
          npi: d.npi || null,
          profession: d.profession,
          specialty: d.specialty,
          licenseState: d.licenseState,
          licenseNumber: d.licenseNumber,
          region: anonLabel(d.specialty, d.profession, d.licenseState).split(", ")[1],
          credentials: {
            create: [
              { kind: "ID", status: "NEEDED" },
              { kind: "LICENSE", status: npiInfo?.licenseNumber === d.licenseNumber ? "PENDING" : "NEEDED" },
              { kind: "BOARD", status: "NEEDED" },
              { kind: "EDUCATION", status: "NEEDED" },
              { kind: "MALPRACTICE", status: "NEEDED" },
            ],
          },
        },
      },
    },
  });
  await startSession(user.id);
  redirect("/verify");
}

export async function signupPractice(_: FormState, form: FormData): Promise<FormState> {
  if (!hit("signup", await clientIp())) return TOO_MANY;
  const parsed = practiceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await emailTaken(d.email)) return { error: "An account with that email already exists" };
  const user = await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      passwordHash: await bcrypt.hash(d.password, 12),
      role: "PRACTICE",
      memberships: { create: { practice: { create: { name: d.practiceName, city: d.city, state: d.state } } } },
    },
  });
  await startSession(user.id);
  redirect("/practice");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!hit("login", await clientIp()) || !hit("login", `email:${email}`)) return TOO_MANY;
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Email or password is wrong" };
  await startSession(user.id);
  redirect(user.role === "PRACTICE" ? "/practice" : user.role === "ADMIN" ? "/admin" : "/lounge");
}

export async function logout() {
  await endSession();
  redirect("/");
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Always answers the same way, so it can't be used to learn who has an account. */
export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState & { sent?: boolean }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!hit("reset", await clientIp()) || !hit("reset", `email:${email}`)) return TOO_MANY;
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) },
    });
    await send(passwordReset(user.email, appUrl(`/reset/${token}`)));
  }
  return { sent: true };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters" };
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "This link has expired. Ask for a new one." };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } }),
    db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // Any other outstanding links for this person stop working too.
    db.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  redirect("/login?reset=1");
}
