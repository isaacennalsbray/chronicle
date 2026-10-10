/**
 * Fills body_text for imported chronicles from their original PDFs, so they display as text
 * like new chronicles. The original file is kept and still served for download. Image
 * chronicles are skipped. Safe to re-run: only chronicles without body_text are processed.
 *
 *   npm run extract:legacy-text -- --dry-run   # print the first lines of each, write nothing
 *   npm run extract:legacy-text
 *   npm run extract:legacy-text -- --redo      # re-extract chronicles that already have text
 */
import { config } from "dotenv";
import { extractText, getDocumentProxy } from "unpdf";

config({ path: ".env.local" });

/**
 * PDF text comes out hard-wrapped at the original column width. Join wrapped lines back into
 * paragraphs: a line that runs close to the full column width continues on the next line,
 * while shorter lines (headings, paragraph ends) end a paragraph. Paragraphs are separated by a
 * blank line so they read as paragraphs on the site.
 */
function reflow(pageText: string): string {
  const lines = pageText.split("\n").map((l) => l.trim());
  const lengths = lines.filter(Boolean).map((l) => l.length).sort((a, b) => a - b);
  const width = lengths[Math.floor(lengths.length * 0.9)] ?? 0;

  let out = "";
  lines.forEach((line, i) => {
    if (i === 0) return void (out = line);
    const prev = lines[i - 1];
    const wrapped = prev.length >= width * 0.75 && !/[.!?:"”]$/.test(prev) && line !== "";
    const continues = prev.length >= width * 0.75 && line !== "" && /^[a-z(]/.test(line);
    out += (wrapped || continues ? " " : "\n\n") + line;
  });
  return out.replace(/-\s(?=[a-z])/g, "-").replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const redo = process.argv.includes("--redo");
  const { and, eq, isNull, isNotNull, like } = await import("drizzle-orm");
  const { db, schema } = await import("../src/db");
  const { chronicles } = schema;

  const rows = await db
    .select({ id: chronicles.id, title: chronicles.title, url: chronicles.legacyFileUrl })
    .from(chronicles)
    .where(
      and(
        isNotNull(chronicles.legacyFileUrl),
        redo ? undefined : isNull(chronicles.bodyText),
        like(chronicles.legacyFileContentType, "application/pdf%"),
      ),
    );

  let done = 0;
  for (const row of rows) {
    const res = await fetch(row.url!);
    if (!res.ok) throw new Error(`GET ${row.url} → ${res.status}`);
    const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: false });
    const body = (text as string[]).map(reflow).filter(Boolean).join("\n\n");

    if (!body) {
      console.log(`  no text found: #${row.id} ${row.title}`);
      continue;
    }
    if (dryRun) {
      console.log(`\n#${row.id} ${row.title} (${body.length} chars)\n${body.slice(0, 300)}`);
      continue;
    }
    await db.update(chronicles).set({ bodyText: body }).where(eq(chronicles.id, row.id));
    done++;
  }
  console.log(`\n${dryRun ? "Dry run: " : ""}${rows.length} PDFs found, ${done} updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
