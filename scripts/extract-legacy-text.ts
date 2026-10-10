/**
 * Fills body_text for imported chronicles from their original PDFs, so they display as text
 * like new chronicles. The original file is kept and still served for download. Image
 * chronicles are skipped. Safe to re-run: only chronicles without body_text are processed.
 *
 *   npm run extract:legacy-text -- --dry-run   # print each result, write nothing
 *   npm run extract:legacy-text
 *   npm run extract:legacy-text -- --redo      # re-extract chronicles that already have text
 */
import { config } from "dotenv";
import { getDocumentProxy } from "unpdf";

config({ path: ".env.local" });

type Line = { text: string; x: number; y: number; size: number };
type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * The page's text lines in reading order, with position and font size. In hand-lettered
 * ("wobbly") documents every word sits at its own height and size, so a line there is
 * everything up to where the text jumps back left, rather than everything on one baseline.
 */
async function pageLines(pdf: PdfDocument, pageNumber: number, wobbly: boolean): Promise<Line[]> {
  const page = await pdf.getPage(pageNumber);
  const { items } = await page.getTextContent();
  const lines: Line[] = [];
  let current: (Line & { end: number }) | null = null;

  for (const item of items) {
    if (!("str" in item) || !item.str) continue;
    const [, , , , x, y] = item.transform as number[];
    const size = Math.round(item.height);
    // Items arrive in reading order, column by column.
    const sameLine =
      current !== null &&
      (wobbly
        ? x >= current.end - 3 && Math.abs(current.y - y) < Math.max(current.size, 8) * 1.5
        : Math.abs(current.y - y) < Math.max(2, Math.min(size, current.size) * 0.4));
    if (current && sameLine) {
      // Separately placed words need a space between them.
      const needsSpace =
        x - current.end > Math.max(size, current.size, 4) * 0.15 && !/\s$/.test(current.text) && !/^\s/.test(item.str);
      current.text += (needsSpace ? " " : "") + item.str;
      current.x = Math.min(current.x, x);
      current.size = Math.max(current.size, size);
      current.end = Math.max(current.end, x + item.width);
    } else {
      if (current?.text.trim()) lines.push(current);
      current = { text: item.str, x, y, size, end: x + item.width };
    }
  }
  if (current?.text.trim()) lines.push(current);
  return lines
    .map((l) => {
      let text = l.text.replace(/\s+/g, " ").trim();
      // Hand-lettered punctuation is placed separately: "ago ." → "ago."
      if (wobbly) text = text.replace(/ ([.,!?;:)])/g, "$1");
      return { text, x: l.x, y: l.y, size: wobbly ? 0 : l.size };
    })
    .filter((l) => !/^\d{1,3}$/.test(l.text)); // page numbers
}

/**
 * Hand-lettered documents place neighbouring words at slightly different heights; typeset
 * ones (including designed newsletters) keep words on a line on exactly the same baseline.
 */
async function isWobbly(pdf: PdfDocument): Promise<boolean> {
  const { items } = await (await pdf.getPage(1)).getTextContent();
  const ys = items.flatMap((i) => ("str" in i && i.str.trim() ? [(i.transform as number[])[5]] : []));
  let jitter = 0;
  for (let i = 1; i < ys.length; i++) {
    const dy = Math.abs(ys[i] - ys[i - 1]);
    if (dy > 0.5 && dy < 7) jitter++;
  }
  return ys.length > 20 && jitter / (ys.length - 1) > 0.3;
}

const BULLET = /^[-–—•●○▪◦■]\s?/; // - – — • ● ○ ▪ ◦ ■
const SENTENCE_END = /[.!?"”)]$/;

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/**
 * Rebuilds paragraphs from line layout, the way the original document marks them:
 * - a clear change of font size (title vs body), a bullet point, or a noticeably larger gap
 *   between lines starts a new paragraph;
 * - in documents that indent paragraphs, an indented body line starts one;
 * - in documents that don't, a short line that ends a sentence ends the paragraph;
 * - a line starting with a lowercase letter always continues the paragraph before it.
 * Lines within a paragraph (including a title wrapping onto two lines) are joined with spaces,
 * and paragraphs continue across page and column breaks. Paragraphs are separated by a blank
 * line.
 */
function paragraphs(lines: Line[], wobbly = false): string[] {
  if (lines.length === 0) return [];

  const gaps = lines
    .slice(1)
    .map((l, i) => lines[i].y - l.y)
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  const lineGap = gaps[Math.floor(gaps.length / 2)] ?? 0;

  // Body text: the most common font size and left margin. Titles are often centered, so
  // indentation only means something in body text.
  const bodySize = mostCommon(lines.map((l) => l.size));
  const isBody = (l: Line) => Math.abs(l.size - bodySize) <= bodySize * 0.25;
  const body = lines.filter(isBody);
  const margin = mostCommon(body.map((l) => Math.round(l.x)));
  const usesIndents = body.some((l) => l.x > margin + 8 && l.x < margin + 60 && /^[A-Z"“']/.test(l.text));
  const fullLength = [...body.map((l) => l.text.length)].sort((a, b) => a - b)[Math.floor(body.length * 0.9)] ?? 0;

  const out: string[] = [];
  let paragraph = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const line = lines[i];
    const gap = prev.y - line.y;
    const sizeChanged = isBody(line) !== isBody(prev) || Math.abs(line.size - prev.size) > prev.size * 0.25;

    let newParagraph: boolean;
    if (sizeChanged) newParagraph = true;
    else if (BULLET.test(line.text)) newParagraph = true;
    else if (/^[a-z]/.test(line.text)) newParagraph = false;
    else if (gap > 0 && gap > Math.max(lineGap, line.size * 1.2) * 1.5) newParagraph = true;
    else if (wobbly) newParagraph = false; // only a large gap counts in hand-lettered text
    else if (usesIndents) {
      // Compare with the line after it when jumping to a new page or column.
      const reference = gap > 0 ? prev : lines[i + 1];
      newParagraph = isBody(line) && reference !== undefined && line.x > reference.x + 8;
    } else {
      newParagraph = isBody(prev) && SENTENCE_END.test(prev.text) && prev.text.length < fullLength * 0.75;
    }

    if (newParagraph) {
      out.push(paragraph);
      paragraph = line.text;
    } else {
      // Rejoin words hyphenated across a line break ("stand-" + "ing").
      paragraph = /[a-z]-$/.test(paragraph) && /^[a-z]/.test(line.text)
        ? paragraph.slice(0, -1) + line.text
        : `${paragraph} ${line.text}`;
    }
  }
  out.push(paragraph);
  return out.filter(Boolean);
}

async function extract(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const pdf = await getDocumentProxy(new Uint8Array(await res.arrayBuffer()));
  // All pages as one run of lines, so paragraphs can continue across page breaks.
  const lines: Line[] = [];
  const wobbly = await isWobbly(pdf);
  for (let n = 1; n <= pdf.numPages; n++) lines.push(...(await pageLines(pdf, n, wobbly)));
  return (
    paragraphs(lines, wobbly)
      .join("\n\n")
      // Some PDFs contain invisible control characters (even nulls) the database won't store.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
      .toWellFormed()
      .trim()
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const redo = process.argv.includes("--redo");
  const only = process.argv.find((a) => a.startsWith("--id="))?.slice(5);
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
        only ? eq(chronicles.id, Number(only)) : undefined,
      ),
    );

  let done = 0;
  for (const row of rows) {
    const body = await extract(row.url!);
    if (!body) {
      console.log(`  no text found: #${row.id} ${row.title}`);
      continue;
    }
    if (dryRun) {
      const paras = body.split("\n\n");
      console.log(`\n#${row.id} ${row.title}: ${paras.length} paragraphs`);
      for (const p of paras) console.log(`  | ${p.length > 90 ? `${p.slice(0, 60)} … ${p.slice(-25)}` : p}`);
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
