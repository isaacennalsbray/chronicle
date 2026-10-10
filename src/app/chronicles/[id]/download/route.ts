import { notFound, redirect } from "next/navigation";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { renderChroniclePdf, retitlePdf } from "@/lib/pdf";
import { byline, chroniclePdfTitle, getChronicleById } from "@/lib/queries";
import { parseChronicleId } from "@/lib/slug";

export async function GET(req: Request, ctx: RouteContext<"/chronicles/[id]/download">) {
  const id = parseChronicleId((await ctx.params).id);
  const row = id ? await getChronicleById(id) : null;
  if (!row || !canView(row.chronicle, await getCurrentUser())) notFound();
  const { chronicle, session } = row;

  const fileBase = await chroniclePdfTitle(chronicle, session);
  const cacheControl = chronicle.status === "approved" ? "public, max-age=300" : "private, no-store";
  // ?inline=1 shows the file in the browser (the on-page viewer) instead of downloading it.
  const disposition = new URL(req.url).searchParams.get("inline") === "1" ? "inline" : "attachment";

  // Imported chronicles: serve the original file under the common name. PDFs also get their
  // stored title (e.g. "Copy of Halimin") replaced with it; content is unchanged.
  if (chronicle.legacyFileUrl) {
    const original = await fetch(chronicle.legacyFileUrl);
    if (!original.ok) notFound();
    const contentType = chronicle.legacyFileContentType ?? "application/octet-stream";
    const extension = contentType.startsWith("image/jpeg")
      ? "jpg"
      : contentType.startsWith("audio/mp4")
        ? "m4a"
        : (contentType.split("/")[1] ?? "pdf");
    let bytes: Uint8Array = new Uint8Array(await original.arrayBuffer());
    if (contentType.startsWith("application/pdf")) bytes = (await retitlePdf(bytes, fileBase)) ?? bytes;
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${fileBase}.${extension}"`,
        "Cache-Control": cacheControl,
      },
    });
  }

  // Videos and files that are no longer available have nothing to download: go to the link.
  if (!chronicle.bodyText) {
    if (chronicle.externalUrl) redirect(chronicle.externalUrl);
    notFound();
  }

  const pdf = await renderChroniclePdf({
    documentTitle: fileBase,
    byline: byline(chronicle),
    body: chronicle.bodyText ?? "",
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileBase}.pdf"`,
      "Cache-Control": cacheControl,
    },
  });
}
