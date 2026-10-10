import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

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

/** All sessions grouped for the submit form's dropdown. */
export async function listSessionOptions() {
  return db
    .select({ session: sessions, season: seasons, league: leagues })
    .from(sessions)
    .innerJoin(seasons, eq(sessions.seasonId, seasons.id))
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
    .orderBy(asc(leagues.sortOrder), desc(seasons.createdAt), desc(sessions.sortOrder), desc(sessions.id));
}

export function seasonTitle(season: { label: string; codename: string | null }, league: { name: string }) {
  return season.codename
    ? `${season.codename} Chronicles (${season.label} ${league.name})`
    : `${league.name} ${season.label}`;
}

export function byline(c: { characterName: string; playerName: string }) {
  return `${c.characterName} (${c.playerName})`;
}

/** The title, unless it just repeats the character name (common for imported entries). */
export function distinctTitle(c: { title: string; characterName: string }) {
  const redundant = [c.characterName, `${c.characterName} Chronicle`].map((t) => t.toLowerCase());
  return redundant.includes(c.title.trim().toLowerCase()) ? null : c.title;
}
