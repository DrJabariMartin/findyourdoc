import Link from "next/link";
import { db } from "@/lib/db";
import { requireVerifiedClinician } from "@/lib/session";
import { anonLabel } from "@/lib/labels";
import Composer, { ReplyBox } from "./Composer";

export default async function Lounge({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const user = await requireVerifiedClinician();
  const { room: slug } = await searchParams;
  const rooms = await db.room.findMany({ orderBy: { sortOrder: "asc" } });
  const room = rooms.find((r) => r.slug === slug) ?? rooms[0];
  if (!room) return <p>No rooms yet. Run the seed script.</p>;
  const posts = await db.post.findMany({
    where: { roomId: room.id, flagged: false },
    include: {
      author: { include: { clinician: true } },
      handle: true,
      replies: { where: { flagged: false }, include: { author: true, handle: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const c = user.clinician;
  const roomLink = (r: (typeof rooms)[number]) => (
    <Link key={r.id} href={`/lounge?room=${r.slug}`}
      className={`px-3 py-2.5 rounded-xl ${r.id === room.id ? "bg-brand-soft text-brand-dark font-semibold" : ""}`}>{r.name}</Link>
  );
  return (
    <div className="flex flex-wrap gap-6 items-start">
      <aside aria-label="Rooms" className="flex-[1_1_240px] max-w-xs flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted px-3">Rooms</span>
          {rooms.filter((r) => !r.support).map(roomLink)}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted px-3">Private support rooms</span>
          {rooms.filter((r) => r.support).map(roomLink)}
        </div>
        <p className="bg-brand-soft rounded-xl p-3.5 text-sm text-brand-dark">Only verified, licensed members can see the Lounge. Practices and recruiters never can. Assume anything you post could be screenshotted.</p>
      </aside>
      <section className="flex-[999_1_560px] min-w-0 flex flex-col gap-4">
        <h1 className="h1">{room.name}</h1>
        <Composer roomId={room.id} anonAs={anonLabel(c.specialty, c.profession, c.licenseState)} namedAs={user.name} />
        {posts.length === 0 && <p className="text-muted">No posts yet. Start the first discussion.</p>}
        {posts.map((p) => {
          const author = p.handle ? p.handle.label : p.author?.name ?? "Member";
          return (
            <article key={p.id} className="card flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-[#DCE8F0] flex items-center justify-center font-bold text-sm">{author.slice(0, 2).toUpperCase()}</span>
                <div className="flex flex-col">
                  <span className="font-semibold">{author}</span>
                  <span className="text-sm text-muted">{p.handle ? "Anonymous, verified" : "Named, verified"} · {p.createdAt.toLocaleDateString("en-US")}</span>
                </div>
              </div>
              <h2 className="font-semibold text-lg">{p.title}</h2>
              <p className="text-ink-2 whitespace-pre-wrap">{p.body}</p>
              {p.replies.length > 0 && (
                <div className="flex flex-col gap-3 border-l-2 border-line pl-4 mt-1" aria-label={`${p.replies.length} replies`}>
                  {p.replies.map((r) => (
                    <div key={r.id} className="flex flex-col gap-0.5">
                      <span className="text-sm"><strong>{r.handle ? r.handle.label : r.author?.name ?? "Member"}</strong> <span className="text-muted">· {r.handle ? "Anonymous, verified" : "Named, verified"} · {r.createdAt.toLocaleDateString("en-US")}</span></span>
                      <p className="text-ink-2 whitespace-pre-wrap">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <ReplyBox postId={p.id} anonAs={anonLabel(c.specialty, c.profession, c.licenseState)} namedAs={user.name} />
            </article>
          );
        })}
      </section>
    </div>
  );
}
