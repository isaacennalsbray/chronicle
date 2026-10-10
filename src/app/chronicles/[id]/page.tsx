import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { byline, getChronicleById, seasonTitle, sessionLabel } from "@/lib/queries";
import { chroniclePath, parseChronicleId } from "@/lib/slug";
import { approveChronicle, rejectChronicle } from "./actions";

type Props = PageProps<"/chronicles/[id]">;

async function load(param: string) {
  const id = parseChronicleId(param);
  const row = id ? await getChronicleById(id) : null;
  const user = await getCurrentUser();
  if (!row || !canView(row.chronicle, user)) return null;
  return { ...row, user };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await load((await params).id);
  return { title: row?.chronicle.title };
}

export default async function ChroniclePage({ params }: Props) {
  const { id: param } = await params;
  const row = await load(param);
  if (!row) notFound();
  const { chronicle, session, season, league, user } = row;

  const canonical = chroniclePath(chronicle);
  if (`/chronicles/${param}` !== canonical) redirect(canonical);

  const isLegacyImage = chronicle.legacyFileContentType?.startsWith("image/");
  const pending = chronicle.status === "pending";
  const rejected = chronicle.status === "rejected";

  return (
    <article>
      {pending && (
        <div className="mb-6 rounded-md bg-warning-bg px-4 py-3 text-sm text-warning-fg">
          <strong>Pending review.</strong> Only the author and admins can see this until it&apos;s approved.
        </div>
      )}
      {rejected && (
        <div className="mb-6 rounded-md bg-rejected-bg px-4 py-3 text-sm text-rejected-fg">
          <strong>Not approved.</strong> An admin decided not to publish this chronicle. Only the author and admins can
          see it.
        </div>
      )}

      <p className="text-sm text-muted">
        <Link href={`/leagues/${league.slug}/${season.slug}`} className="link">
          {seasonTitle(season, league)}
        </Link>{" "}
        · {sessionLabel(session)}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{chronicle.title}</h1>
      {chronicle.title !== byline(chronicle) && <p className="mt-1 text-lg text-muted">{byline(chronicle)}</p>}

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`${canonical}/download`} className="btn">
          Download {isLegacyImage ? "image" : "PDF"}
        </a>
        {(pending || rejected) && user?.isAdmin && (
          <form action={approveChronicle}>
            <input type="hidden" name="id" value={chronicle.id} />
            <button className="btn-secondary">Approve</button>
          </form>
        )}
        {pending && user?.isAdmin && (
          <form action={rejectChronicle}>
            <input type="hidden" name="id" value={chronicle.id} />
            <button className="btn-secondary">Reject</button>
          </form>
        )}
      </div>

      <div className="mt-8">
        {chronicle.legacyFileUrl ? (
          isLegacyImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- original scanned chronicle, shown as-is
            <img src={chronicle.legacyFileUrl} alt={`${chronicle.title} by ${chronicle.playerName}`} className="w-full rounded-md border border-border" />
          ) : (
            <iframe
              src={chronicle.legacyFileUrl}
              title={chronicle.title}
              className="h-[80vh] w-full rounded-md border border-border bg-white"
            />
          )
        ) : (
          <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed">{chronicle.bodyText}</div>
        )}
      </div>
    </article>
  );
}
