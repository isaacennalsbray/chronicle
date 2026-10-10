import "server-only";
import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";

type ChroniclePdfInput = {
  title: string;
  byline: string; // e.g. "Zeek (Isaac)"
  header: string; // e.g. "Helios · S14 · 4th of Ninthmoon, 287.3.3"
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
  doc.setTitle(input.title);
  doc.setAuthor(input.byline);

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const textWidth = PAGE.width - MARGIN * 2;
  const muted = rgb(0.35, 0.35, 0.35);

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

  draw(input.header.toUpperCase(), sans, 9, 12, muted);
  y -= 8;
  draw(input.title, serifBold, 22, 28);
  draw(input.byline, serif, 13, 18, muted);
  y -= 18;
  draw(input.body.replace(/\r\n?/g, "\n").replace(/\t/g, "    "), serif, BODY_SIZE, LINE_HEIGHT);

  return doc.save();
}
