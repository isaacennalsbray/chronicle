import { notFound } from "next/navigation";
import { canView } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { renderChroniclePdf } from "@/lib/pdf";
import { byline, chroniclePdfTitle, getChronicleById } from "@/lib/queries";
import { parseChronicleId } from "@/lib/slug";

export async function GET(_req: Request, ctx: RouteContext<"/chronicles/[id]/download">) {
  const id = parseChronicleId((await ctx.params).id);
  const row = id ? await getChronicleById(id) : null;
  if (!row || !canView(row.chronicle, await getCurrentUser())) notFound();
  const { chronicle, session } = row;

  const fileBase = await chroniclePdfTitle(chronicle, session);
  const cacheControl = chronicle.status === "approved" ? "public, max-age=300" : "private, no-store";

  // Imported chronicles: serve the original file untouched, under the common file name.
  if (chronicle.legacyFileUrl) {
    const original = await fetch(chronicle.legacyFileUrl);
    if (!original.ok || !original.body) notFound();
    const contentType = chronicle.legacyFileContentType ?? "application/octet-stream";
    const extension = contentType.startsWith("image/jpeg") ? "jpg" : (contentType.split("/")[1] ?? "pdf");
    return new Response(original.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileBase}.${extension}"`,
        "Cache-Control": cacheControl,
      },
    });
  }

  const pdf = await renderChroniclePdf({
    documentTitle: fileBase,
    byline: byline(chronicle),
    body: chronicle.bodyText ?? "",
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileBase}.pdf"`,
      "Cache-Control": cacheControl,
    },
  });
}
