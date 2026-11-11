import "server-only";
import { db } from "./db";

/**
 * Loads an application for whoever is looking: the clinician who applied or
 * a member of the practice that posted the job. Anyone else gets null.
 */
export async function applicationFor(userId: string, id: string) {
  const a = await db.application.findUnique({
    where: { id },
    include: {
      job: { include: { practice: { include: { members: { include: { user: true } } } } } },
      clinician: { include: { user: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!a) return null;
  if (a.clinician.userId === userId) return { a, asPractice: false };
  if (a.job.practice.members.some((m) => m.userId === userId)) return { a, asPractice: true };
  return null;
}

