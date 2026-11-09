"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { hit } from "@/lib/ratelimit";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, saveFile, sniffType } from "@/lib/storage";

export type UploadState = { ok?: string; error?: string } | undefined;

export async function uploadCredential(_prev: UploadState, form: FormData): Promise<UploadState> {
  const user = await requireUser();
  if (!user.clinician) return { error: "Only clinicians upload credentials." };
  if (!hit("upload", user.id)) return { error: "Too many uploads. Try again in an hour." };

  const credentialId = String(form.get("credentialId") ?? "");
  const cred = await db.credential.findFirst({ where: { id: credentialId, clinicianId: user.clinician.id } });
  if (!cred) return { error: "Pick which credential this document is for." };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Files can be up to 10 MB." };

  const buf = new Uint8Array(await file.arrayBuffer());
  const mime = sniffType(buf);
  if (!mime || !ALLOWED_TYPES[mime]) return { error: "Upload a PDF, JPG or PNG." };

  const storageKey = await saveFile(buf, mime);
  const fileName = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `document.${ALLOWED_TYPES[mime]}`;
  await db.$transaction([
    db.credentialDocument.create({ data: { credentialId: cred.id, fileName, mimeType: mime, sizeBytes: buf.byteLength, storageKey } }),
    ...(cred.status === "NEEDED" || cred.status === "EXPIRED"
      ? [db.credential.update({ where: { id: cred.id }, data: { status: "PENDING" } })]
      : []),
  ]);
  revalidatePath("/verify");
  revalidatePath("/admin");
  return { ok: "Uploaded. Our team will check it, usually within 2 business days." };
}
