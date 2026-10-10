/**
 * Sets event_date on imported chronicles so their PDFs follow the same naming system as new
 * ones (e.g. 2026-09-04ChronicleTobin). The date comes from the session's in-game date (the
 * moon is the month, the day is the day), with the year taken from the original file name
 * ("260904ChronicleTobin.pdf" or "2508chronicleandy.pdf" → 2026 / 2025). Safe to re-run: only
 * chronicles without an event_date are updated.
 *
 *   npm run backfill:legacy-dates -- --dry-run
 *   npm run backfill:legacy-dates
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  const { db, schema } = await import("../src/db");
  const { realDateFromInGameDate } = await import("../src/lib/moons");
  const { chronicles, sessions } = schema;

  const rows = await db
    .select({ id: chronicles.id, file: chronicles.legacySourceUrl, inGameDate: sessions.inGameDate, playedOn: sessions.playedOn })
    .from(chronicles)
    .innerJoin(sessions, eq(chronicles.sessionId, sessions.id))
    .where(and(isNotNull(chronicles.legacySourceUrl), isNull(chronicles.eventDate)));

  let updated = 0;
  for (const row of rows) {
    const fileName = row.file!.split("/").pop()!;
    const yy = /^(\d{2})\d{2}/.exec(fileName)?.[1];
    const eventDate =
      (yy && row.inGameDate ? realDateFromInGameDate(row.inGameDate, 2000 + Number(yy)) : null) ?? row.playedOn;
    if (!eventDate) {
      console.log(`  no date for #${row.id} ${fileName}`);
      continue;
    }
    console.log(`  #${row.id} ${fileName} (${row.inGameDate}) → ${eventDate}`);
    if (!dryRun) await db.update(chronicles).set({ eventDate }).where(eq(chronicles.id, row.id));
    updated++;
  }
  console.log(`\n${dryRun ? "Dry run: " : ""}${updated} of ${rows.length} dated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
