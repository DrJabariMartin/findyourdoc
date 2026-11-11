"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVerifiedClinician } from "@/lib/session";
import { findIdentifiers } from "@/lib/identifiers";
import { anonLabel } from "@/lib/labels";
import { safely } from "@/lib/automation/jobs";
import { notifyPostAuthor } from "@/lib/lounge";

export type PostState = { error?: string; held?: string[]; ok?: boolean } | undefined;

const schema = z.object({
  roomId: z.string().min(1),
  title: z.string().trim().min(5, "Add a short title").max(160),
  body: z.string().trim().min(10, "Say a little more").max(8000),
  anonymous: z.enum(["on", "off"]),
});

/** Returns the user's anonymous handle, creating it in the vault on first use. */
async function handleFor(userId: string, label: string) {
  const v = await db.handleVault.findUnique({ where: { userId } });
  if (v) return v.handleId;
  const h = await db.anonHandle.create({ data: { label, vault: { create: { userId } } } });
  return h.id;
}

export async function createPost(_: PostState, form: FormData): Promise<PostState> {
  const user = await requireVerifiedClinician();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const found = findIdentifiers(`${d.title}\n${d.body}`);
  const c = user.clinician;
  const handleId = d.anonymous === "on" ? await handleFor(user.id, anonLabel(c.specialty, c.profession, c.licenseState)) : null;
  await db.post.create({
    data: {
      roomId: d.roomId,
      title: d.title,
      body: d.body,
      flagged: found.length > 0,
      ...(handleId ? { handleId } : { authorId: user.id }),
    },
  });
  revalidatePath("/lounge");
  return found.length ? { held: found } : { ok: true };
}

const replySchema = z.object({
  postId: z.string().min(1),
  body: z.string().trim().min(2, "Say a little more").max(4000),
  anonymous: z.enum(["on", "off"]),
});

/** Replies follow the same rules as posts: verified members only, identifier check, handle vault. */
export async function createReply(_: PostState, form: FormData): Promise<PostState> {
  const user = await requireVerifiedClinician();
  const parsed = replySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const post = await db.post.findFirst({ where: { id: d.postId, flagged: false }, select: { id: true } });
  if (!post) return { error: "That discussion is no longer available." };
  const found = findIdentifiers(d.body);
  const c = user.clinician;
  const handleId = d.anonymous === "on" ? await handleFor(user.id, anonLabel(c.specialty, c.profession, c.licenseState)) : null;
  const reply = await db.reply.create({
    data: { postId: d.postId, body: d.body, flagged: found.length > 0, ...(handleId ? { handleId } : { authorId: user.id }) },
  });
  if (!reply.flagged) await safely(notifyPostAuthor(reply.id));
  revalidatePath("/lounge");
  return found.length ? { held: found } : { ok: true };
}

