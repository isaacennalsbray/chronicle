/**
 * Imports the six Season 11/14 chronicles that import-legacy-seasons.ts skipped because they
 * aren't PDFs or images:
 *
 * - Tine (Jack), Syenon S14: an Apple Pages file of three notebook photos → made into a PDF;
 * - Obb II (Dylan), Zari-Kiri S11: an audio recording on Google Drive → stored as audio;
 * - Coppers (Kore) ×2, Zari-Kiri S11: YouTube videos → embedded from YouTube;
 * - Obb and Bedtime Story by Obb (Dylan), Zari-Kiri S11: Google Drive files that have been
 *   deleted → listed, noting the original is no longer available.
 *
 * Safe to re-run: chronicles already imported (matched on their original link) are skipped.
 *
 *   npm run import:legacy-media
 */
import { config } from "dotenv";
import JSZip from "jszip";

config({ path: ".env.local" });

type Item = {
  season: string; // codename
  session: string; // start of the in-game date heading
  title: string;
  characterName: string;
  playerName: string;
  source: string; // the link on the old site
  kind: "pages" | "audio" | "youtube" | "unavailable";
};

const ITEMS: Item[] = [
  { season: "Syenon", session: "30th of Eigthmoon", title: "Tine", characterName: "Tine", playerName: "Jack", source: "https://falnoriangames.com/wp-content/uploads/2026/10/260830ChronicleJackI.pages", kind: "pages" },
  { season: "Zari-Kiri", session: "27th of Eigthmoon", title: "Coppers", characterName: "Coppers", playerName: "Kore", source: "https://www.youtube.com/watch?v=wgc4fu_0YSA", kind: "youtube" },
  { season: "Zari-Kiri", session: "24th of Ninthmoon", title: "Coppers", characterName: "Coppers", playerName: "Kore", source: "https://www.youtube.com/watch?v=CQWngNMN5GI", kind: "youtube" },
  { season: "Zari-Kiri", session: "3rd of Twelfthmoon", title: "Obb", characterName: "Obb", playerName: "Dylan", source: "https://drive.google.com/file/d/1Kp09ZeYz2c2KRPwG01KDRBh1u4WqOz0x/view", kind: "unavailable" },
  { season: "Zari-Kiri", session: "3rd of Twelfthmoon", title: "Bedtime Story by Obb", characterName: "Obb", playerName: "Dylan", source: "https://drive.google.com/file/d/13ij9RSfSNnJ-A6XN1WogA_Vn6rjXGuuE/view", kind: "unavailable" },
  { season: "Zari-Kiri", session: "25th of Secondmoon", title: "Obb II", characterName: "Obb", playerName: "Dylan", source: "https://drive.google.com/file/d/1P4lO0jNalE4lRmnOWMQaA9K11FGZitJ0", kind: "audio" },
];

const USER_AGENT = { "User-Agent": "Mozilla/5.0 (chronicle importer)" };

async function download(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, { headers: USER_AGENT });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type")?.split(";")[0] ?? "" };
}

/** An Apple Pages document's pictures as a PDF, one page per picture (web-sized JPEGs). */
async function pagesToPdf(pagesFile: Buffer): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");
  const sharp = (await import("sharp")).default;
  const zip = await JSZip.loadAsync(pagesFile);
  const pictures = Object.keys(zip.files)
    .filter((n) => /^Data\/pasted-image-\d+\.(png|jpe?g)$/i.test(n))
    .sort((a, b) => Number(/(\d+)\./.exec(a)![1]) - Number(/(\d+)\./.exec(b)![1]));
  if (pictures.length === 0) throw new Error("No pictures in the Pages file");

  const pdf = await PDFDocument.create();
  for (const name of pictures) {
    const jpeg = await sharp(await zip.files[name].async("nodebuffer"))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const image = await pdf.embedJpg(jpeg);
    pdf.addPage([image.width, image.height]).drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return Buffer.from(await pdf.save());
}

async function main() {
  const { and, eq, ilike } = await import("drizzle-orm");
  const { put } = await import("@vercel/blob");
  const { db, schema } = await import("../src/db");
  const { slugify } = await import("../src/lib/slug");
  const { seasons, sessions, chronicles } = schema;

  for (const item of ITEMS) {
    if (await db.query.chronicles.findFirst({ where: eq(chronicles.legacySourceUrl, item.source) })) {
      console.log(`  already imported: ${item.title} (${item.playerName})`);
      continue;
    }
    const season = await db.query.seasons.findFirst({ where: eq(seasons.codename, item.season) });
    if (!season) throw new Error(`Season ${item.season} missing`);
    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.seasonId, season.id), ilike(sessions.inGameDate, `${item.session}%`)),
    });
    if (!session) throw new Error(`Session ${item.session} missing in ${item.season}`);

    let file: { url: string; contentType: string } | null = null;
    if (item.kind === "pages") {
      const pdf = await pagesToPdf((await download(item.source)).bytes);
      const blob = await put(`legacy/media/${slugify(`${item.season}-${item.title}-${item.playerName}`)}.pdf`, pdf, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      file = { url: blob.url, contentType: "application/pdf" };
    } else if (item.kind === "audio") {
      const id = /\/d\/([\w-]+)/.exec(item.source)![1];
      const { bytes, contentType } = await download(`https://drive.google.com/uc?export=download&id=${id}`);
      if (!contentType.startsWith("audio/")) throw new Error(`Expected audio for ${item.title}, got ${contentType}`);
      const blob = await put(`legacy/media/${slugify(`${item.season}-${item.title}-${item.playerName}`)}.m4a`, bytes, {
        access: "public",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      file = { url: blob.url, contentType };
    }

    await db.insert(chronicles).values({
      sessionId: session.id,
      title: item.title,
      slug: slugify(`${item.characterName} ${item.playerName}`),
      characterName: item.characterName,
      playerName: item.playerName,
      status: "approved",
      eventDate: session.playedOn,
      // Tine's Pages file is Jack's first chronicle that day ("JackI"), so it goes before his PDF.
      submittedAt: session.playedOn
        ? new Date(`${session.playedOn}T${item.kind === "pages" ? "11:59" : "12:00"}:00Z`)
        : new Date(),
      approvedAt: new Date(),
      legacyFileUrl: file?.url ?? null,
      legacyFileContentType: file?.contentType ?? null,
      legacySourceUrl: item.source,
      externalUrl: file ? null : item.source,
    });
    console.log(`  imported ${item.title} (${item.playerName}) as ${item.kind}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
