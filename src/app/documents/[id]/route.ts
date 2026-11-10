import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readStored } from "@/lib/storage";

// Serves a credential document only to its owner or to an admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const doc = await db.credentialDocument.findUnique({ where: { id }, include: { credential: true } });
  const owner = doc && user.clinician && doc.credential.clinicianId === user.clinician.id;
  if (!doc || !(owner || user.role === "ADMIN")) return new Response("Not found", { status: 404 });
  const body = await readStored(doc.storageKey);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
