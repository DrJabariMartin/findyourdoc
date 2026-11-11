import "server-only";
import { db } from "./db";
import { enqueue } from "./automation/jobs";
import { messages } from "./automation/rules";
import { appUrl } from "./email";

/**
 * Emails a post's author about a new reply. For an anonymous post the vault
 * resolves the handle to its owner here, on the server only. The email holds a
 * link, never the reply's words. A held reply notifies once an admin releases it.
 */
export async function notifyPostAuthor(replyId: string) {
  const reply = await db.reply.findUnique({
    where: { id: replyId },
    include: { post: { select: { authorId: true, handleId: true, flagged: true, room: { select: { slug: true } } } } },
  });
  if (!reply || reply.flagged || reply.post.flagged) return;
  const post = reply.post;
  const ownerId = post.authorId ?? (post.handleId ? (await db.handleVault.findUnique({ where: { handleId: post.handleId } }))?.userId : null);
  if (!ownerId) return;
  // Don't tell people about their own replies, named or anonymous.
  const replierId = reply.authorId ?? (reply.handleId ? (await db.handleVault.findUnique({ where: { handleId: reply.handleId } }))?.userId : null);
  if (ownerId === replierId) return;
  const owner = await db.user.findUnique({ where: { id: ownerId }, select: { email: true } });
  if (owner) await enqueue(`lounge-reply:${replyId}`, owner.email, "LOUNGE_REPLY", messages.loungeReply(appUrl(""), post.room.slug));
}
