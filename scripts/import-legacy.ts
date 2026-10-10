/**
 * Imports the chronicles listed on the old falnoriangames.com season pages.
 *
 * Each page is one league-season: an <h3> per session (in-game date) followed by a
 * paragraph of "Character (Player)" links, each pointing at the original PDF or image.
 * Files are copied to Vercel Blob unchanged. Safe to re-run: chronicles already imported
 * (matched on their original file URL) are skipped.
 *
 *   npm run import:legacy -- --dry-run   # parse and print only
 *   npm run import:legacy
 */
import { config } from "dotenv";
import * as cheerio from "cheerio";

config({ path: ".env.local" });

const PAGES = [
  { league: "helios", url: "https://falnoriangames.com/2026/10/02/eldar-chronicles-s14-helios/" },
  { league: "tessellations", url: "https://falnoriangames.com/2026/10/02/valcion-chronicles-s14-tessellations/" },
  { league: "sunday-larp", url: "https://falnoriangames.com/2026/10/02/kythrim-chronicles-s14-faljl/" },
  { league: "adult-league", url: "https://falnoriangames.com/2025/09/04/illmythil-chronicles-s13-falal/" },
];

type Entry = {
  title: string;
  characterName: string;
  playerName: string;
  fileUrl: string;
};

type ParsedPage = {
  league: string;
  url: string;
  codename: string | null;
  seasonLabel: string;
  sessions: { inGameDate: string; playedOn: string | null; entries: Entry[] }[];
};

async function fetchText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (chronicle importer)" } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

/** "260904ChronicleTobin.pdf" → "2026-09-04". Older files only encode year+month. */
function playedOnFromFile(fileUrl: string): string | null {
  const m = /\/(\d{2})(\d{2})(\d{2})chronicle/i.exec(fileUrl);
  return m ? `20${m[1]}-${m[2]}-${m[3]}` : null;
}

function parsePage(html: string, league: string, url: string): ParsedPage {
  const $ = cheerio.load(html);
  const heading = $("h1.entry-title, .entry-title").first().text().trim();
  // "Eldar Chronicles (S14 Helios)"
  const titleMatch = /^(.*?)\s+Chronicles\s*\((S\d+)\b/i.exec(heading);
  if (!titleMatch) throw new Error(`Unrecognised page title "${heading}" at ${url}`);

  const sessions: ParsedPage["sessions"] = [];
  $(".entry-content")
    .children()
    .each((_, el) => {
      const node = $(el);
      if (node.is("h3")) {
        sessions.push({ inGameDate: node.text().trim(), playedOn: null, entries: [] });
        return;
      }
      const current = sessions.at(-1);
      if (!current || !node.is("p")) return;

      node.find("a[href]").each((_, a) => {
        const label = $(a).text().replace(/\s+/g, " ").trim();
        const m = /^(.*)\(([^)]+)\)$/.exec(label);
        if (!m) throw new Error(`Unrecognised entry "${label}" at ${url}`);
        const title = m[1].trim();
        current.entries.push({
          title,
          characterName: title.replace(/\s+Chronicle(\s+[IVX]+)?$/i, ""),
          playerName: m[2].trim(),
          fileUrl: $(a).attr("href")!,
        });
      });
    });

  for (const session of sessions) {
    session.playedOn = session.entries.map((e) => playedOnFromFile(e.fileUrl)).find(Boolean) ?? null;
    // "Bartholomew I" / "Bartholomew II" are two chronicles by one character in one session.
    for (const entry of session.entries) {
      const base = entry.characterName.replace(/\s+[IVX]+$/, "");
      const siblings = session.entries.filter(
        (e) => e.playerName === entry.playerName && e.characterName.replace(/\s+[IVX]+$/, "") === base,
      );
      if (siblings.length > 1) entry.characterName = base;
    }
  }

  return {
    league,
    url,
    codename: titleMatch[1].trim(),
    seasonLabel: titleMatch[2].toUpperCase(),
    sessions,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pages: ParsedPage[] = [];
  for (const { league, url } of PAGES) {
    pages.push(parsePage(await fetchText(url), league, url));
  }

  if (dryRun) {
    for (const page of pages) {
      console.log(`\n${page.codename} Chronicles (${page.seasonLabel}) → ${page.league}`);
      for (const s of page.sessions) {
        console.log(`  ${s.inGameDate}${s.playedOn ? ` [${s.playedOn}]` : ""}`);
        for (const e of s.entries) {
          console.log(`    - ${e.title} | ${e.characterName} (${e.playerName}) | ${e.fileUrl.split("/").pop()}`);
        }
      }
    }
    const total = pages.flatMap((p) => p.sessions.flatMap((s) => s.entries)).length;
    console.log(`\n${total} chronicles across ${pages.length} pages (dry run, nothing written).`);
    return;
  }

  const { and, eq } = await import("drizzle-orm");
  const { put } = await import("@vercel/blob");
  const { db, schema } = await import("../src/db");
  const { seedLeagues } = await import("./seed");
  const { slugify } = await import("../src/lib/slug");

  await seedLeagues();
  let imported = 0;
  let skipped = 0;

  for (const page of pages) {
    const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.slug, page.league) });
    if (!league) throw new Error(`League ${page.league} missing`);

    const seasonSlug = slugify(page.seasonLabel);
    await db
      .insert(schema.seasons)
      .values({
        leagueId: league.id,
        slug: seasonSlug,
        label: page.seasonLabel,
        codename: page.codename,
        legacySourceUrl: page.url,
      })
      .onConflictDoNothing();
    const season = (await db.query.seasons.findFirst({
      where: and(eq(schema.seasons.leagueId, league.id), eq(schema.seasons.slug, seasonSlug)),
    }))!;

    for (const [index, s] of page.sessions.entries()) {
      let session = await db.query.sessions.findFirst({
        where: and(eq(schema.sessions.seasonId, season.id), eq(schema.sessions.inGameDate, s.inGameDate)),
      });
      session ??= (
        await db
          .insert(schema.sessions)
          .values({ seasonId: season.id, inGameDate: s.inGameDate, playedOn: s.playedOn, sortOrder: index + 1 })
          .returning()
      )[0];

      for (const entry of s.entries) {
        const existing = await db.query.chronicles.findFirst({
          where: eq(schema.chronicles.legacySourceUrl, entry.fileUrl),
        });
        if (existing) {
          skipped++;
          continue;
        }

        const res = await fetch(entry.fileUrl, { headers: { "User-Agent": "Mozilla/5.0 (chronicle importer)" } });
        if (!res.ok) throw new Error(`GET ${entry.fileUrl} → ${res.status}`);
        const contentType = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
        const fileName = entry.fileUrl.split("/").pop()!;
        const blob = await put(`legacy/${page.league}/${seasonSlug}/${fileName}`, Buffer.from(await res.arrayBuffer()), {
          access: "public",
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
        });

        await db.insert(schema.chronicles).values({
          sessionId: session.id,
          title: entry.title,
          slug: slugify(`${entry.characterName} ${entry.playerName}`),
          characterName: entry.characterName,
          playerName: entry.playerName,
          status: "approved",
          submittedAt: s.playedOn ? new Date(`${s.playedOn}T12:00:00Z`) : new Date(),
          approvedAt: new Date(),
          legacyFileUrl: blob.url,
          legacyFileContentType: contentType,
          legacySourceUrl: entry.fileUrl,
        });
        imported++;
        console.log(`  imported ${entry.title} (${entry.playerName}) — ${fileName}`);
      }
    }
  }

  console.log(`\nDone: ${imported} imported, ${skipped} already present.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
