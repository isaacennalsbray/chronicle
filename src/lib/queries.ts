import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Chronicle } from "@/db/schema";

const { leagues, seasons, sessions, chronicles } = schema;

const chronicleWithContext = {
  chronicle: chronicles,
  session: sessions,
  season: seasons,
  league: leagues,
};

function withContext() {
  return db
    .select(chronicleWithContext)
    .from(chronicles)
    .innerJoin(sessions, eq(chronicles.sessionId, sessions.id))
    .innerJoin(seasons, eq(sessions.seasonId, seasons.id))
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id));
}

export type ChronicleWithContext = NonNullable<Awaited<ReturnType<typeof getChronicleById>>>;

export async function getChronicleById(id: number) {
  const [row] = await withContext().where(eq(chronicles.id, id)).limit(1);
  return row ?? null;
}

export async function listLeaguesWithSeasons() {
  const rows = await db
    .select({ league: leagues, season: seasons })
    .from(leagues)
    .leftJoin(seasons, eq(seasons.leagueId, leagues.id))
    .orderBy(asc(leagues.sortOrder), desc(seasons.createdAt));

  const byLeague = new Map<number, { league: typeof leagues.$inferSelect; seasons: (typeof seasons.$inferSelect)[] }>();
  for (const { league, season } of rows) {
    const entry = byLeague.get(league.id) ?? { league, seasons: [] };
    if (season) entry.seasons.push(season);
    byLeague.set(league.id, entry);
  }
  return [...byLeague.values()];
}

export async function getLeagueBySlug(slug: string) {
  return (await db.query.leagues.findFirst({ where: eq(leagues.slug, slug) })) ?? null;
}

export async function getSeason(leagueSlug: string, seasonSlug: string) {
  const [row] = await db
    .select({ league: leagues, season: seasons })
    .from(seasons)
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
    .where(and(eq(leagues.slug, leagueSlug), eq(seasons.slug, seasonSlug)))
    .limit(1);
  return row ?? null;
}

/**
 * Sessions of a season, each with its approved chronicles in display order. The viewer's
 * own pending chronicles are included too, so authors can see where theirs will appear.
 */
export async function getSeasonListing(seasonId: number, viewerId: number | null) {
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.seasonId, seasonId))
    .orderBy(asc(sessions.sortOrder), asc(sessions.id));

  const chronicleRows = await db
    .select({ chronicle: chronicles })
    .from(chronicles)
    .innerJoin(sessions, eq(chronicles.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.seasonId, seasonId),
        viewerId === null
          ? eq(chronicles.status, "approved")
          : or(
              eq(chronicles.status, "approved"),
              and(eq(chronicles.status, "pending"), eq(chronicles.authorUserId, viewerId)),
            ),
      ),
    )
    .orderBy(asc(chronicles.submittedAt), asc(chronicles.id));

  return sessionRows.map((session) => ({
    session,
    chronicles: chronicleRows.map((r) => r.chronicle).filter((c) => c.sessionId === session.id),
  }));
}

export async function listPendingChronicles() {
  return withContext()
    .where(eq(chronicles.status, "pending"))
    .orderBy(asc(chronicles.submittedAt));
}

export async function listChroniclesByAuthor(userId: number) {
  return withContext()
    .where(eq(chronicles.authorUserId, userId))
    .orderBy(desc(chronicles.submittedAt));
}

export async function listLeagues() {
  return db.select().from(leagues).orderBy(asc(leagues.sortOrder));
}

/** Every session with its league, newest season first, for the submit form. */
export async function listSessionOptions() {
  return db
    .select({ session: sessions, season: seasons, league: leagues })
    .from(sessions)
    .innerJoin(seasons, eq(sessions.seasonId, seasons.id))
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
    .orderBy(asc(leagues.sortOrder), desc(seasons.createdAt), asc(sessions.sortOrder), asc(sessions.id));
}

/**
 * The chronicle's position among one player's published chronicles in its session, oldest
 * first, or null when it is their only one (or isn't published yet).
 */
export async function chronicleNumber(c: Pick<Chronicle, "id" | "sessionId" | "playerName">) {
  const siblings = await db
    .select({ id: chronicles.id, status: chronicles.status })
    .from(chronicles)
    .where(
      and(
        eq(chronicles.sessionId, c.sessionId),
        sql`lower(trim(${chronicles.playerName})) = lower(trim(${c.playerName}))`,
      ),
    )
    .orderBy(asc(chronicles.submittedAt), asc(chronicles.id));
  // Only published chronicles are numbered, so a pending one doesn't renumber the others.
  const published = siblings.filter((s) => s.status === "approved");
  const index = published.findIndex((s) => s.id === c.id);
  return published.length > 1 && index >= 0 ? index + 1 : null;
}

export function seasonTitle(season: { label: string; codename: string | null }, league: { name: string }) {
  return season.codename
    ? `${season.codename} Chronicles (${season.label} ${league.name})`
    : `${league.name} ${season.label}`;
}

export function byline(c: { characterName: string; playerName: string }) {
  return `${c.characterName} (${c.playerName})`;
}

type Labelable = Pick<Chronicle, "id" | "sessionId" | "characterName" | "playerName">;

/**
 * Display labels like "Bartholomew (Tobin)", numbered "Bartholomew (Tobin) I" / "… II" when
 * one session has several published chronicles with the same character and player, in
 * submission order. Pending and rejected chronicles are never numbered and don't count.
 */
export async function chronicleLabels(rows: Labelable[]): Promise<Map<number, string>> {
  const labels = new Map(rows.map((c) => [c.id, byline(c)]));
  if (rows.length === 0) return labels;

  const sessionIds = [...new Set(rows.map((c) => c.sessionId))];
  const siblings = await db
    .select({
      id: chronicles.id,
      sessionId: chronicles.sessionId,
      characterName: chronicles.characterName,
      playerName: chronicles.playerName,
    })
    .from(chronicles)
    .where(and(inArray(chronicles.sessionId, sessionIds), eq(chronicles.status, "approved")))
    .orderBy(asc(chronicles.submittedAt), asc(chronicles.id));

  const groups = new Map<string, number[]>();
  for (const c of siblings) {
    const key = `${c.sessionId}|${c.characterName.trim().toLowerCase()}|${c.playerName.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), c.id]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((id, i) => {
      const row = rows.find((c) => c.id === id);
      if (row) labels.set(id, `${byline(row)} ${ROMAN[i] ?? i + 1}`);
    });
  }
  return labels;
}

export function formatPlayedOn(playedOn: string) {
  return new Date(`${playedOn}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
}

/** The in-game date, falling back to the real date if a session has none. */
export function sessionLabel(session: { inGameDate: string | null; playedOn: string | null }) {
  return session.inGameDate ?? (session.playedOn ? formatPlayedOn(session.playedOn) : "Date to be announced");
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** e.g. "2026-09-18ChronicleTobinII" — number only when a player has several in a session. */
export function chronicleFileBase(playedOn: string, playerName: string, number: number | null) {
  const player = playerName.normalize("NFKD").replace(/[^A-Za-z0-9]/g, "") || "Player";
  const suffix = number ? (ROMAN[number - 1] ?? String(number)) : "";
  return `${playedOn}Chronicle${player}${suffix}`;
}

/**
 * The chronicle's PDF title, which is also its download file name (without extension), the
 * same for every chronicle: e.g. "2026-10-09ChronicleIsaac", with I/II when a player has more
 * than one in a session.
 */
export async function chroniclePdfTitle(
  chronicle: Chronicle,
  session: { playedOn: string | null },
): Promise<string> {
  const eventDate = chronicle.eventDate ?? session.playedOn ?? chronicle.submittedAt.toISOString().slice(0, 10);
  return chronicleFileBase(eventDate, chronicle.playerName, await chronicleNumber(chronicle));
}
