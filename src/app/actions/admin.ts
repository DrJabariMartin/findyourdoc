"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STATES } from "@/lib/labels";
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

const licenseSchema = z.object({
  clinicianId: z.string().min(1),
  state: z.enum(STATES as [string, ...string[]]),
  number: z.string().trim().min(2).max(40),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

/**
 * Adds a license in another state. Only after checking that state's board
 * lookup (for example the Maryland Board of Physicians, DC Health or the
 * Virginia Board of Medicine): an NPI alone does not prove a license.
 */
export async function addLicense(form: FormData) {
  await requireAdmin();
  const parsed = licenseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const d = parsed.data;
  const expiresAt = d.expiresAt ? new Date(`${d.expiresAt}T23:59:59Z`) : null;
  await db.stateLicense.upsert({
    where: { clinicianId_state: { clinicianId: d.clinicianId, state: d.state } },
    create: { clinicianId: d.clinicianId, state: d.state, number: d.number, expiresAt },
    update: { number: d.number, expiresAt, verifiedAt: new Date() },
  });
  revalidatePath("/admin");
}

export async function removeLicense(form: FormData) {
  await requireAdmin();
  await db.stateLicense.deleteMany({ where: { id: String(form.get("licenseId")) } });
  revalidatePath("/admin");
}

/** Fee waiver and ownership disclosure, for a related-party pilot such as the founder's practice. */
export async function setPilotTerms(form: FormData) {
  await requireAdmin();
  const clean = (v: FormDataEntryValue | null) => String(v ?? "").trim().slice(0, 200) || null;
  await db.clinicianProfile.update({
    where: { id: String(form.get("clinicianId")) },
    data: { feeWaiver: clean(form.get("feeWaiver")), ownerDisclosure: clean(form.get("ownerDisclosure")) },
  });
  revalidatePath("/admin");
}
