import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readStored } from "@/lib/storage";
import { practiceMayOpen } from "@/lib/hiring";

// Serves a credential document to its owner, an admin, or a practice the
// clinician applied to and chose to share verified documents with.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const doc = await db.credentialDocument.findUnique({ where: { id }, include: { credential: true } });
  const owner = doc && user.clinician && doc.credential.clinicianId === user.clinician.id;
  let practice = false;
  if (doc && !owner && user.role === "PRACTICE" && doc.credential.status === "VERIFIED") {
    const shared = await db.application.findFirst({
      where: { clinicianId: doc.credential.clinicianId, shareDocs: true, job: { practice: { members: { some: { userId: user.id } } } } },
    });
    practice = practiceMayOpen(shared, doc.credential.status);
  }
  if (!doc || !(owner || practice || user.role === "ADMIN")) return new Response("Not found", { status: 404 });
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
