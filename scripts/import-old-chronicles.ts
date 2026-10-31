/**
 * Imports the old falnoriangames.com "Old Chronicles" page: chronicles players wrote later about
 * seasons long past. They get their own section, the "Old Chronicles" league, shown as one page:
 *
 * - each entry ("Reflections by Gorn – By Gorn (Andrew) || Garemin, Ardel, 180.3.2") becomes an
 *   approved chronicle whose original file is copied to Vercel Blob;
 * - the place and year ("Garemin, Ardel, 180.3.2") is its session, in the order the old page
 *   lists them. The season it's about ("(S9)") isn't used: everything goes in the league's one
 *   season, so a place written about in two seasons is one session.
 *
 * Google Drive folders (the Season 1–9 collection, Marlo's notes) aren't single files, so they're
 * skipped and listed. Safe to re-run: chronicles already imported (matched on their original file
 * URL) are moved to their session rather than copied again, and sessions and seasons of the
 * league left empty are removed. Afterwards run `npm run extract:legacy-text`.
 *
 *   npm run import:old-chronicles -- --dry-run
 *   npm run import:old-chronicles
 */
import * as cheerio from "cheerio";
import { config } from "dotenv";
import { OLD_CHRONICLES_LEAGUE, OLD_CHRONICLES_SEASON } from "../src/lib/old-chronicles";

config({ path: ".env.local" });

const PAGE_URL = "https://falnoriangames.com/2023/11/30/old-chronicles/";
const USER_AGENT = { "User-Agent": "Mozilla/5.0 (chronicle importer)" };

type Entry = { title: string; characterName: string; playerName: string; fileUrl: string };
type ParsedSession = { setting: string; entries: Entry[] };

/** Only files the site can show: PDFs and images hosted on the old site. */
function importable(fileUrl: string) {
  return /falnoriangames\.com\/wp-content\/uploads\/.+\.(pdf|jpe?g|png)$/i.test(fileUrl);
}

function parsePage(html: string): { sessions: ParsedSession[]; skipped: string[] } {
  const $ = cheerio.load(html);
  const sessions: ParsedSession[] = [];
  const skipped: string[] = [];

  // The list itself, not the share buttons under it.
  $(".entry-content ul.wp-block-list > li").each((_, el) => {
    const li = $(el);
    const fileUrl = li.find("a[href]").first().attr("href");
    const text = li.text().replace(/\s+/g, " ").trim();
    if (!fileUrl) return;
    if (!importable(fileUrl)) {
      skipped.push(`${text} → ${fileUrl}`);
      return;
    }

    // "Reflections by Gorn – By Gorn (Andrew) || Garemin, Ardel, 180.3.2 (S9)"
    const [about, where = ""] = text.split("||").map((s) => s.trim());
    const m = /^(.*?)\s+[–—-]\s+By\s+(.*?)\s*\(([^)]+)\)\s*$/i.exec(about);
    if (!m) throw new Error(`Unrecognised entry "${text}"`);
    const [, title, character, player] = m;

    const setting = where
      .replace(/\s*\(S\d+\)?\s*$/i, "")
      .replace(/\bIl+-A(?:rk|kr)h-Nazril\b/, "Il-Arkh-Nazril") // typos on the old page
      .trim();

    let session = sessions.find((s) => s.setting === setting);
    if (!session) sessions.push((session = { setting, entries: [] }));
    // Entries like "Chronicle on Court of Light Dungeon – By (Benjamin)" name no character.
    session.entries.push({ title, characterName: character.trim() || "Chronicle", playerName: player.trim(), fileUrl });
  });

  return { sessions, skipped };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const res = await fetch(PAGE_URL, { headers: USER_AGENT });
  if (!res.ok) throw new Error(`GET ${PAGE_URL} → ${res.status}`);
  const { sessions: parsed, skipped } = parsePage(await res.text());

  if (dryRun) {
    console.log("\nOld Chronicles");
    for (const s of parsed) {
      console.log(`  ${s.setting}`);
      for (const e of s.entries) console.log(`    - ${e.characterName} (${e.playerName}) | ${e.title} | ${e.fileUrl.split("/").pop()}`);
    }
    console.log(`\nSkipped (not a single file):\n  ${skipped.join("\n  ") || "none"}`);
    return;
  }

  const { and, count, eq, inArray, ne, notInArray, sql } = await import("drizzle-orm");
  const { put } = await import("@vercel/blob");
  const { db, schema } = await import("../src/db");
  const { seedLeagues } = await import("./seed");
  const { slugify } = await import("../src/lib/slug");
  const { leagues, seasons, sessions, chronicles, users, userCharacters } = schema;

  await seedLeagues();
  const league = await db.query.leagues.findFirst({ where: eq(leagues.slug, OLD_CHRONICLES_LEAGUE) });
  if (!league) throw new Error(`League ${OLD_CHRONICLES_LEAGUE} missing`);

  await db
    .insert(seasons)
    .values({ leagueId: league.id, slug: OLD_CHRONICLES_SEASON, label: "All", legacySourceUrl: PAGE_URL })
    .onConflictDoNothing();
  const season = (await db.query.seasons.findFirst({
    where: and(eq(seasons.leagueId, league.id), eq(seasons.slug, OLD_CHRONICLES_SEASON)),
  }))!;

  let imported = 0;
  let moved = 0;
  let existing = 0;
  for (const [index, s] of parsed.entries()) {
    let session = await db.query.sessions.findFirst({
      where: and(eq(sessions.seasonId, season.id), eq(sessions.inGameDate, s.setting)),
    });
    if (session) {
      await db.update(sessions).set({ sortOrder: index + 1 }).where(eq(sessions.id, session.id));
    } else {
      [session] = await db
        .insert(sessions)
        .values({ seasonId: season.id, inGameDate: s.setting, sortOrder: index + 1 })
        .returning();
    }

    for (const entry of s.entries) {
      const already = await db.query.chronicles.findFirst({ where: eq(chronicles.legacySourceUrl, entry.fileUrl) });
      if (already) {
        if (already.sessionId === session.id) {
          existing++;
        } else {
          await db.update(chronicles).set({ sessionId: session.id }).where(eq(chronicles.id, already.id));
          moved++;
          console.log(`  moved ${entry.characterName} (${entry.playerName}) to ${s.setting}`);
        }
        continue;
      }

      const file = await fetch(entry.fileUrl, { headers: USER_AGENT });
      if (!file.ok) {
        console.log(`  could not download ${entry.fileUrl} (${file.status})`);
        continue;
      }
      const contentType = file.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream";
      const fileName = entry.fileUrl.split("/").pop()!;
      const blob = await put(`legacy/${OLD_CHRONICLES_LEAGUE}/${fileName}`, Buffer.from(await file.arrayBuffer()), {
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
        approvedAt: new Date(),
        legacyFileUrl: blob.url,
        legacyFileContentType: contentType,
        legacySourceUrl: entry.fileUrl,
      });
      imported++;
      console.log(`  imported ${entry.characterName} (${entry.playerName}) — ${fileName}`);
    }
  }

  // Remove the league's sessions and seasons that are now empty (e.g. the old per-season ones).
  // Counts every chronicle, pending and rejected too, so nothing is lost.
  const leagueSeasons = db.select({ id: seasons.id }).from(seasons).where(eq(seasons.leagueId, league.id));
  const used = db.selectDistinct({ id: chronicles.sessionId }).from(chronicles);
  const emptied = await db
    .delete(sessions)
    .where(and(inArray(sessions.seasonId, leagueSeasons), notInArray(sessions.id, used)))
    .returning({ setting: sessions.inGameDate });
  const withSessions = db.selectDistinct({ id: sessions.seasonId }).from(sessions);
  const removedSeasons = await db
    .delete(seasons)
    .where(and(eq(seasons.leagueId, league.id), ne(seasons.id, season.id), notInArray(seasons.id, withSessions)))
    .returning({ label: seasons.label });
  const [{ left }] = await db
    .select({ left: count() })
    .from(seasons)
    .where(and(eq(seasons.leagueId, league.id), ne(seasons.id, season.id)));

  // Give people who already set up their names any newly imported chronicles that match.
  await db.execute(sql`
    update ${chronicles} c set author_user_id = u.id
    from ${users} u join ${userCharacters} uc on uc.user_id = u.id
    where c.author_user_id is null and c.legacy_source_url is not null
      and lower(trim(c.player_name)) = lower(trim(u.player_name))
      and lower(trim(c.character_name)) = lower(trim(uc.name))`);

  console.log(`\nDone: ${imported} imported, ${moved} moved, ${existing} already in place.`);
  console.log(`Removed ${emptied.length} empty sessions and ${removedSeasons.length} empty seasons (${removedSeasons.map((s) => s.label).join(", ") || "none"}).`);
  if (left > 0) console.log(`${left} other Old Chronicles seasons still have chronicles; check them.`);
  console.log(`Skipped (not a single file):\n  ${skipped.join("\n  ") || "none"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
