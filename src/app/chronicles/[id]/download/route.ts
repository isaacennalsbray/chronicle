import { notFound, redirect } from "next/navigation";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { renderChroniclePdf } from "@/lib/pdf";
import { byline, chronicleFileBase, chronicleNumber, getChronicleById, seasonTitle, sessionLabel } from "@/lib/queries";
import { parseChronicleId } from "@/lib/slug";

export async function GET(_req: Request, ctx: RouteContext<"/chronicles/[id]/download">) {
  const id = parseChronicleId((await ctx.params).id);
  const row = id ? await getChronicleById(id) : null;
  if (!row || !canView(row.chronicle, await getCurrentUser())) notFound();
  const { chronicle, session, season, league } = row;

  // Imported chronicles: serve the original file untouched.
  if (chronicle.legacyFileUrl) {
    const url = new URL(chronicle.legacyFileUrl);
    url.searchParams.set("download", "1");
    redirect(url.toString());
  }

  const eventDate = chronicle.eventDate ?? session.playedOn ?? chronicle.submittedAt.toISOString().slice(0, 10);
  const fileBase = chronicleFileBase(eventDate, chronicle.playerName, await chronicleNumber(chronicle));

  const pdf = await renderChroniclePdf({
    documentTitle: fileBase,
    byline: byline(chronicle),
    header: `${seasonTitle(season, league)} · ${sessionLabel(session)}`,
    body: chronicle.bodyText ?? "",
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileBase}.pdf"`,
      "Cache-Control": chronicle.status === "approved" ? "public, max-age=300" : "private, no-store",
    },
  });
}
