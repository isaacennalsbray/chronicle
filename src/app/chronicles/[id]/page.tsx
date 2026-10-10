import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { chronicleLabels, getChronicleById, seasonTitle, sessionLabel } from "@/lib/queries";
import { chroniclePath, parseChronicleId } from "@/lib/slug";
import { DeleteButton } from "./delete-button";
import { ReviewControls } from "./review-controls";

type Props = PageProps<"/chronicles/[id]">;

async function load(param: string) {
  const id = parseChronicleId(param);
  const row = id ? await getChronicleById(id) : null;
  const user = await getCurrentUser();
  if (!row || !canView(row.chronicle, user)) return null;
  const label = (await chronicleLabels([row.chronicle])).get(row.chronicle.id)!;
  return { ...row, user, label };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await load((await params).id);
  return { title: row?.label };
}

export default async function ChroniclePage({ params }: Props) {
  const { id: param } = await params;
  const row = await load(param);
  if (!row) notFound();
  const { chronicle, session, season, league, user, label } = row;

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
          <strong>Rejected.</strong> An admin decided not to publish this chronicle. Only the author and admins can
          see it.
          {chronicle.rejectionReason && (
            <p className="mt-2 whitespace-pre-wrap">
              <strong>Reason:</strong> {chronicle.rejectionReason}
            </p>
          )}
        </div>
      )}

      <p className="text-sm text-muted">
        <Link href={`/leagues/${league.slug}/${season.slug}`} className="link">
          {seasonTitle(season, league)}
        </Link>{" "}
        · {sessionLabel(session)}
      </p>
      <h1 className="mt-2 font-serif text-4xl font-semibold">{label}</h1>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`${canonical}/download`} className="btn">
          Download {isLegacyImage ? "image" : "PDF"}
        </a>
        {user?.isAdmin && <DeleteButton id={chronicle.id} title={label} />}
      </div>
      {(pending || rejected) && user?.isAdmin && (
        <div className="mt-4">
          <ReviewControls id={chronicle.id} canReject={pending} />
        </div>
      )}

      <div className="mt-8">
        {/* Text when we have it (new chronicles, and imported PDFs with extractable text);
            otherwise the original scan. */}
        {chronicle.bodyText ? (
          <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed">{chronicle.bodyText}</div>
        ) : isLegacyImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- original scanned chronicle, shown as-is
          <img src={chronicle.legacyFileUrl!} alt={`${label}, by ${chronicle.playerName}`} className="w-full rounded-md border border-border" />
        ) : chronicle.legacyFileUrl ? (
          <iframe
            src={chronicle.legacyFileUrl}
            title={label}
            className="h-[80vh] w-full rounded-md border border-border bg-white"
          />
        ) : null}
      </div>
    </article>
  );
}
