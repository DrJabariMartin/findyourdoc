"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { onClinicianVerified, safely } from "@/lib/automation/jobs";

import { RECHECK_DAYS } from "@/lib/automation/rules";

export async function decide(form: FormData) {
  await requireAdmin();
  const id = String(form.get("clinicianId"));
  const verdict = String(form.get("verdict"));
  if (verdict === "approve") {
    const now = new Date();
    await db.$transaction([
      db.clinicianProfile.update({
        where: { id },
        data: { status: "VERIFIED", verifiedAt: now, nextRecheckAt: new Date(now.getTime() + RECHECK_DAYS * 86_400_000) },
      }),
      db.credential.updateMany({
        where: { clinicianId: id, kind: { in: ["ID", "LICENSE", "BOARD", "EDUCATION"] } },
        data: { status: "VERIFIED", checkedAt: now },
      }),
    ]);
    await safely(onClinicianVerified(id));
  } else if (verdict === "reject") {
    await db.clinicianProfile.update({ where: { id }, data: { status: "REJECTED" } });
  }
  revalidatePath("/admin");
}

export async function releasePost(form: FormData) {
  await requireAdmin();
  const id = String(form.get("postId"));
  if (form.get("verdict") === "release") await db.post.update({ where: { id }, data: { flagged: false } });
  else await db.post.delete({ where: { id } });
  revalidatePath("/admin");
}

export async function releaseReply(form: FormData) {
  await requireAdmin();
  const id = String(form.get("replyId"));
  if (form.get("verdict") === "release") await db.reply.update({ where: { id }, data: { flagged: false } });
  else await db.reply.delete({ where: { id } });
  revalidatePath("/admin");
}
