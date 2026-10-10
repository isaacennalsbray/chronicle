import "server-only";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

type ChroniclePdfInput = {
  documentTitle: string; // PDF metadata title, e.g. "2026-09-04ChronicleIsaac"
  byline: string; // PDF metadata author, e.g. "Zeek (Isaac)"
  body: string;
};

const PAGE = { width: 612, height: 792 }; // US Letter
const MARGIN = 72;
const BODY_SIZE = 11.5;
const LINE_HEIGHT = BODY_SIZE * 1.45;

const TYPOGRAPHIC: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"',
  "–": "-", "—": "--", "…": "...", " ": " ",
};

// Standard PDF fonts only cover WinAnsi; swap anything else for a safe fallback.
function encodable(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text) {
    const candidate = TYPOGRAPHIC[ch] ?? ch;
    if (candidate === "\n") {
      out += candidate;
      continue;
    }
    try {
      font.encodeText(candidate);
      out += candidate;
    } catch {
      out += "?";
    }
  }
  return out;
}

function wrap(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // Hard-break words wider than the line.
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderChroniclePdf(input: ChroniclePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.documentTitle);
  doc.setAuthor(input.byline);

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const textWidth = PAGE.width - MARGIN * 2;

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const draw = (text: string, font: PDFFont, size: number, lineHeight: number, color = rgb(0, 0, 0)) => {
    for (const line of wrap(font, size, encodable(font, text), textWidth)) {
      if (y - lineHeight < MARGIN) {
        page = doc.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
      }
      y -= lineHeight;
      page.drawText(line, { x: MARGIN, y, size, font, color });
    }
  };

  draw(input.body.replace(/\r\n?/g, "\n").replace(/\t/g, "    "), serif, BODY_SIZE, LINE_HEIGHT);

  return doc.save();
}

/**
 * Replaces the title stored inside an existing PDF (what viewers show in their title bar), e.g.
 * an old-site file titled "Copy of Halimin". Content and layout are untouched. Returns null if
 * the file can't be rewritten, so the caller can serve the original instead.
 */
export async function retitlePdf(bytes: Uint8Array, title: string): Promise<Uint8Array | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    doc.setTitle(title);
    return await doc.save({ useObjectStreams: false });
  } catch {
    return null;
  }
}
