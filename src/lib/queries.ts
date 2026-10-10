import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
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

/** Sessions of a season, each with its approved chronicles, in display order. */
export async function getSeasonListing(seasonId: number) {
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.seasonId, seasonId))
    .orderBy(asc(sessions.sortOrder), asc(sessions.id));

  const chronicleRows = await db
    .select({ chronicle: chronicles })
    .from(chronicles)
    .innerJoin(sessions, eq(chronicles.sessionId, sessions.id))
    .where(and(eq(sessions.seasonId, seasonId), eq(chronicles.status, "approved")))
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
 * The chronicle's position among one player's chronicles in its session, or null when
 * it is their only one. Counts approved chronicles plus this one, oldest first.
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
  const counted = siblings.filter((s) => s.status === "approved" || s.id === c.id);
  return counted.length > 1 ? counted.findIndex((s) => s.id === c.id) + 1 : null;
}

export function seasonTitle(season: { label: string; codename: string | null }, league: { name: string }) {
  return season.codename
    ? `${season.codename} Chronicles (${season.label} ${league.name})`
    : `${league.name} ${season.label}`;
}

export function byline(c: { characterName: string; playerName: string }) {
  return `${c.characterName} (${c.playerName})`;
}

/** The title, unless it just repeats the byline or character name. */
export function distinctTitle(c: { title: string; characterName: string; playerName: string }) {
  const redundant = [c.characterName, `${c.characterName} Chronicle`, byline(c)].map((t) => t.toLowerCase());
  return redundant.includes(c.title.trim().toLowerCase()) ? null : c.title;
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
