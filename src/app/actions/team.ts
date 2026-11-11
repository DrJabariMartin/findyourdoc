"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePractice, startSession } from "@/lib/session";
import { appUrl, send, teamInvite } from "@/lib/email";
import { canInvite, hashInviteToken, INVITE_DAYS } from "@/lib/team";
import { hit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/client-ip";

export type TeamState = { error?: string; ok?: string } | undefined;

export async function inviteTeammate(_: TeamState, form: FormData): Promise<TeamState> {
  const { user, practice } = await requirePractice();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email" };
  if (!hit("signup", `invite:${user.id}`)) return { error: "Too many invites. Please try again later." };
  const now = new Date();
  const [members, open] = await Promise.all([
    db.practiceMember.count({ where: { practiceId: practice.id } }),
    db.practiceInvite.count({ where: { practiceId: practice.id, acceptedAt: null, expiresAt: { gt: now } } }),
  ]);
  if (!canInvite(practice.plan, members, open)) return { error: "Your Solo plan includes one admin. Group adds your whole team." };
  if (await db.user.findUnique({ where: { email } })) return { error: "That email already has a FindYourDoc account. Ask them to use their work email, or contact support." };
  const token = randomBytes(32).toString("base64url");
  await db.practiceInvite.create({
    data: { practiceId: practice.id, email, tokenHash: hashInviteToken(token), invitedBy: user.id, expiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000) },
  });
  await send(teamInvite(email, practice.name, user.name, appUrl(`/join/${token}`)));
  revalidatePath("/practice");
  return { ok: `Invite sent to ${email}.` };
}

export async function revokeInvite(form: FormData) {
  const { practice } = await requirePractice();
  await db.practiceInvite.deleteMany({ where: { id: String(form.get("inviteId")), practiceId: practice.id, acceptedAt: null } });
  revalidatePath("/practice");
}

const joinSchema = z.object({
  token: z.string().min(20),
  name: z.string().trim().min(2, "Enter your name"),
  password: z.string().min(10, "Use at least 10 characters"),
});

/** The invited person creates their account and joins the practice in one step. */
export async function acceptInvite(_: TeamState, form: FormData): Promise<TeamState> {
  if (!hit("signup", await clientIp())) return { error: "Too many attempts. Please wait a few minutes and try again." };
  const parsed = joinSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const inv = await db.practiceInvite.findUnique({ where: { tokenHash: hashInviteToken(d.token) } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return { error: "This invite has expired. Ask your practice to send a new one." };
  if (await db.user.findUnique({ where: { email: inv.email } })) return { error: "An account with this email already exists. Sign in instead." };
  const passwordHash = await bcrypt.hash(d.password, 12);
  const user = await db.$transaction(async (tx) => {
    // Claim the invite first so it can be used only once.
    const claimed = await tx.practiceInvite.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("used");
    return tx.user.create({
      data: { name: d.name, email: inv.email, passwordHash, role: "PRACTICE", memberships: { create: { practiceId: inv.practiceId } } },
    });
  }).catch(() => null);
  if (!user) return { error: "This invite was already used." };
  await startSession(user.id);
  redirect("/practice");
}
