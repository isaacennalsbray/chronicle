/**
 * Imports seasons 10–14 from the old falnoriangames.com chronicle pages (those not already
 * imported by import-legacy.ts), so they follow the same rules as the rest of the site:
 *
 * - each page is a season ("Adra Chronicles, 2nd Semester (Helios, S10)" → Helios S10,
 *   codename Adra); 1st and 2nd semester pages fill the same season;
 * - each heading is a session ("20th of Firstmoon, Year 194.1.3"); paragraphs under it become
 *   the session description; its real date comes from the moon date and the season's year
 *   (S10 began in 2022: Eighthmoon–Twelfthmoon that year, Firstmoon onward the next);
 * - each "Player Chronicles" entry becomes an approved chronicle whose original file is copied
 *   to Vercel Blob. An entry with several links ("Otracis Chronicle [Part I] [Part II] (Isaac)")
 *   becomes several chronicles, numbered I/II by the site.
 *
 * Videos, audio and other files that aren't PDFs or images are skipped and listed.
 * Safe to re-run: existing seasons/sessions are reused and chronicles already imported (matched
 * on their original file URL) are skipped. Afterwards run `npm run extract:legacy-text`.
 *
 *   npm run import:legacy-seasons -- --dry-run
 *   npm run import:legacy-seasons
 */
import * as cheerio from "cheerio";
import { config } from "dotenv";
import { realDateFromInGameDate } from "../src/lib/moons";

config({ path: ".env.local" });

// In order, so 1st-semester sessions come before 2nd-semester ones.
const PAGES: { league: string; url: string }[] = [
  { league: "helios", url: "https://falnoriangames.com/2022/09/21/adra-chronicles-helios-s10/" },
  { league: "helios", url: "https://falnoriangames.com/2023/02/06/adra-chronicles-2nd-semester-helios-s10/" },
  { league: "helios", url: "https://falnoriangames.com/2023/10/18/belmouth-chronicles-1st-semester-helios-s11/" },
  { league: "helios", url: "https://falnoriangames.com/2024/02/17/belmouth-chronicles-2nd-semester-helios-s11/" },
  { league: "helios", url: "https://falnoriangames.com/2024/09/21/anguron-chronicles-1st-semester-s12-helios/" },
  { league: "helios", url: "https://falnoriangames.com/2025/09/07/orizan-chronicles-s13-helios/" },
  { league: "tessellations", url: "https://falnoriangames.com/2022/09/15/demons-well-chronicles-tessellations-s10/" },
  { league: "tessellations", url: "https://falnoriangames.com/2023/02/06/demons-well-chronicles-2nd-semester-tessellations-s10/" },
  { league: "tessellations", url: "https://falnoriangames.com/2023/10/18/weyrwoods-chronicles-1st-semester-tessellations-s11/" },
  { league: "tessellations", url: "https://falnoriangames.com/2024/02/17/weyrwoods-chronicles-2nd-semester-tessellations-s11/" },
  { league: "tessellations", url: "https://falnoriangames.com/2024/09/30/tezchitatl-chronicles-1st-semester-s12-tessellations/" },
  { league: "tessellations", url: "https://falnoriangames.com/2025/10/06/celandi-chronicles-s13-tessellations/" },
  { league: "adult-league", url: "https://falnoriangames.com/2022/09/26/il-arkh-nazril-chronicles-falal-s10/" },
  { league: "adult-league", url: "https://falnoriangames.com/2023/08/28/zari-kiri-chronicles-falal-s11/" },
  { league: "adult-league", url: "https://falnoriangames.com/2024/09/30/halidar-chronicles-s12-falal/" },
  { league: "adult-league", url: "https://falnoriangames.com/2026/10/02/syenon-chronicles-s14-falal/" },
  { league: "sunday-larp", url: "https://falnoriangames.com/2022/09/15/tanager-walk-chronicles-faljl-s10/" },
  { league: "sunday-larp", url: "https://falnoriangames.com/2024/09/21/coravane-chronicles-s12-faljl/" },
  { league: "sunday-larp", url: "https://falnoriangames.com/2025/10/06/kythrim-chronicles-s13-faljl/" },
];

type Entry = { title: string; characterName: string; playerName: string; fileUrl: string };
type ParsedSession = { inGameDate: string; playedOn: string | null; description: string; entries: Entry[] };
type ParsedPage = { league: string; url: string; codename: string; seasonNumber: number; sessions: ParsedSession[] };

const USER_AGENT = { "User-Agent": "Mozilla/5.0 (chronicle importer)" };

/** "Otracis Chronicle" → "Otracis", "Zet'Ubar II" → "Zet'Ubar", "Bedtime Story by Obb" → "Obb". */
function characterFrom(label: string): string {
  const byline = /\bby\s+(.+)$/i.exec(label);
  const name = (byline ? byline[1] : label)
    .replace(/\s+Chronicles?\b.*$/i, "")
    .replace(/\s+(?:Pt\.?|Part)\s+[IVX]+$/i, "")
    .replace(/\s+(?:Pt\.?|Part)$/i, "")
    .replace(/\s+(?:I|II|III|IV|V)$/, "")
    .trim();
  return name || "Chronicle"; // entries like "Chronicle (Davis)" name no character
}

function parsePage(html: string, league: string, url: string): ParsedPage {
  const $ = cheerio.load(html);
  const heading = $("h1.entry-title").first().text().trim();
  const seasonNumber = Number(/\bS(\d+)\b/.exec(heading)?.[1]);
  const codename = /^(.*?)\s+Chronicles\b/.exec(heading)?.[1].trim();
  if (!seasonNumber || !codename) throw new Error(`Unrecognised page title "${heading}" at ${url}`);
  const firstYear = 2012 + seasonNumber; // S10 began in fall 2022

  const sessions: ParsedSession[] = [];
  $(".entry-content")
    .children()
    .each((_, el) => {
      const node = $(el);
      if (/^h[1-6]$/.test(el.tagName)) {
        const inGameDate = node.text().replace(/\s+/g, " ").trim();
        const month = /of\s+([a-z]+moon)/i.exec(inGameDate)?.[1].toLowerCase() ?? "";
        const early = ["firstmoon", "secondmoon", "thirdmoon", "fourthmoon", "fifthmoon", "sixthmoon", "seventhmoon"];
        const year = early.includes(month) ? firstYear + 1 : firstYear;
        sessions.push({ inGameDate, playedOn: realDateFromInGameDate(inGameDate, year), description: "", entries: [] });
        return;
      }
      const session = sessions.at(-1);
      if (!session || !node.is("p")) return;
      const text = node.text().replace(/\s+/g, " ").trim();
      if (!text) return;

      if (!/^Player Chronicles/i.test(text)) {
        session.description += (session.description ? "\n\n" : "") + text;
        return;
      }

      // Entries are separated by "||"; one entry can hold several links (Part I, Part II).
      const body = node.html()!.replace(/^[\s\S]*?Player Chronicles:?\s*(<\/strong>\s*)*/i, "");
      for (const part of body.split("||")) {
        const piece = cheerio.load(`<span>${part}</span>`);
        const links = piece("a[href]").toArray().map((a) => piece(a).attr("href")!);
        if (links.length === 0) continue;
        const plain = piece("span").text().replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
        const player = /\(([^)]+)\)?\s*$/.exec(plain)?.[1]?.replace(/\s+(?:I|II|III)$/, "").trim();
        const label = plain.replace(/\(([^)]+)\)?\s*$/, "").trim();
        if (!player) throw new Error(`No player in "${plain}" at ${url}`);
        for (const fileUrl of links) {
          session.entries.push({ title: label || "Chronicle", characterName: characterFrom(label), playerName: player, fileUrl });
        }
      }
    });

  return { league, url, codename, seasonNumber, sessions };
}

/** Only files the site can show: PDFs and images hosted on the old site. */
function importable(fileUrl: string) {
  return /falnoriangames\.com\/wp-content\/uploads\/.+\.(pdf|jpe?g|png)$/i.test(fileUrl);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const pages: ParsedPage[] = [];
  for (const { league, url } of PAGES) {
    const res = await fetch(url, { headers: USER_AGENT });
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    pages.push(parsePage(await res.text(), league, url));
  }

  const skipped = pages.flatMap((p) =>
    p.sessions.flatMap((s) =>
      s.entries.filter((e) => !importable(e.fileUrl)).map((e) => `${p.codename} S${p.seasonNumber}, ${s.inGameDate}: ${e.title} (${e.playerName}) → ${e.fileUrl}`),
    ),
  );

  if (dryRun) {
    for (const p of pages) {
      const entries = p.sessions.flatMap((s) => s.entries);
      console.log(`\n${p.codename} S${p.seasonNumber} → ${p.league}: ${p.sessions.length} sessions, ${entries.length} chronicles`);
      for (const s of p.sessions) {
        console.log(`  ${s.inGameDate} [${s.playedOn ?? "no date"}]${s.description ? ` (+${s.description.length} chars description)` : ""}`);
        for (const e of s.entries) console.log(`    - ${e.characterName} (${e.playerName}) | ${e.title} | ${e.fileUrl.split("/").pop()}`);
      }
    }
    console.log(`\nSkipped (not a PDF or image):\n  ${skipped.join("\n  ") || "none"}`);
    return;
  }

  const { and, eq, max, sql } = await import("drizzle-orm");
  const { put } = await import("@vercel/blob");
  const { db, schema } = await import("../src/db");
  const { slugify } = await import("../src/lib/slug");
  const { leagues, seasons, sessions, chronicles, users, userCharacters } = schema;

  let imported = 0;
  let existing = 0;
  for (const page of pages) {
    const league = await db.query.leagues.findFirst({ where: eq(leagues.slug, page.league) });
    if (!league) throw new Error(`League ${page.league} missing`);

    const label = `S${page.seasonNumber}`;
    const seasonSlug = slugify(label);
    await db
      .insert(seasons)
      .values({ leagueId: league.id, slug: seasonSlug, label, codename: page.codename, legacySourceUrl: page.url })
      .onConflictDoNothing();
    const season = (await db.query.seasons.findFirst({
      where: and(eq(seasons.leagueId, league.id), eq(seasons.slug, seasonSlug)),
    }))!;

    for (const s of page.sessions) {
      let session = await db.query.sessions.findFirst({
        where: and(eq(sessions.seasonId, season.id), eq(sessions.inGameDate, s.inGameDate)),
      });
      if (!session) {
        const [{ last }] = await db.select({ last: max(sessions.sortOrder) }).from(sessions).where(eq(sessions.seasonId, season.id));
        [session] = await db
          .insert(sessions)
          .values({
            seasonId: season.id,
            inGameDate: s.inGameDate,
            playedOn: s.playedOn,
            description: s.description || null,
            sortOrder: (last ?? 0) + 1,
          })
          .returning();
      } else if (!session.description && s.description) {
        await db.update(sessions).set({ description: s.description }).where(eq(sessions.id, session.id));
      }

      for (const entry of s.entries) {
        if (!importable(entry.fileUrl)) continue;
        if (await db.query.chronicles.findFirst({ where: eq(chronicles.legacySourceUrl, entry.fileUrl) })) {
          existing++;
          continue;
        }

        const res = await fetch(entry.fileUrl, { headers: USER_AGENT });
        if (!res.ok) {
          console.log(`  could not download ${entry.fileUrl} (${res.status})`);
          continue;
        }
        const contentType = res.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
        const fileName = entry.fileUrl.split("/").pop()!;
        const blob = await put(`legacy/${page.league}/${seasonSlug}/${fileName}`, Buffer.from(await res.arrayBuffer()), {
          access: "public",
          contentType,
          addRandomSuffix: false,
          allowOverwrite: true,
        });

        await db.insert(chronicles).values({
          sessionId: session.id,
          title: entry.title,
          slug: slugify(`${entry.characterName} ${entry.playerName}`),
          characterName: entry.characterName,
          playerName: entry.playerName,
          status: "approved",
          eventDate: s.playedOn,
          submittedAt: s.playedOn ? new Date(`${s.playedOn}T12:00:00Z`) : new Date(),
          approvedAt: new Date(),
          legacyFileUrl: blob.url,
          legacyFileContentType: contentType,
          legacySourceUrl: entry.fileUrl,
        });
        imported++;
        console.log(`  imported ${entry.characterName} (${entry.playerName}) — ${fileName}`);
      }
    }
  }

  // Give people who already set up their names any newly imported chronicles that match.
  await db.execute(sql`
    update ${chronicles} c set author_user_id = u.id
    from ${users} u join ${userCharacters} uc on uc.user_id = u.id
    where c.author_user_id is null and c.legacy_source_url is not null
      and lower(trim(c.player_name)) = lower(trim(u.player_name))
      and lower(trim(c.character_name)) = lower(trim(uc.name))`);


  console.log(`\nDone: ${imported} imported, ${existing} already present.`);
  console.log(`Skipped (not a PDF or image):\n  ${skipped.join("\n  ") || "none"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
