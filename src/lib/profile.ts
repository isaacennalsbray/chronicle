import "server-only";
import { and, asc, count, eq, inArray, isNotNull, isNull, not, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { users, userCharacters, chronicles } = schema;

export async function getCharacters(userId: number): Promise<string[]> {
  const rows = await db
    .select({ name: userCharacters.name })
    .from(userCharacters)
    .where(eq(userCharacters.userId, userId))
    .orderBy(asc(userCharacters.id));
  return rows.map((r) => r.name);
}

/** How many of the person's chronicles (submitted or linked) use each character, keyed by lower-case name. */
export async function chronicleCountsByCharacter(userId: number): Promise<Map<string, number>> {
  const rows = await db
    .select({ name: sql<string>`lower(trim(${chronicles.characterName}))`, n: count() })
    .from(chronicles)
    .where(eq(chronicles.authorUserId, userId))
    .groupBy(sql`lower(trim(${chronicles.characterName}))`);
  return new Map(rows.map((r) => [r.name, r.n]));
}

/**
 * Links every unclaimed chronicle (imported, or added by an admin for someone else) with the
 * person's real name and one of their characters to them, and unlinks imported ones that no
 * longer match. Chronicles already linked to someone else are left alone. Returns how many
 * imported chronicles are now theirs.
 */
async function relinkImportedChronicles(userId: number) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const playerName = user?.playerName?.trim().toLowerCase() ?? "";
  const lowered = (await getCharacters(userId)).map((c) => c.trim().toLowerCase());

  const namesMatch = and(
    sql`lower(trim(${chronicles.playerName})) = ${playerName}`,
    lowered.length > 0 ? inArray(sql`lower(trim(${chronicles.characterName}))`, lowered) : sql`false`,
  )!;
  const matches = and(isNotNull(chronicles.legacySourceUrl), namesMatch)!;

  await db
    .update(chronicles)
    .set({ authorUserId: null })
    .where(and(eq(chronicles.authorUserId, userId), isNotNull(chronicles.legacySourceUrl), not(matches)));
  await db.update(chronicles).set({ authorUserId: userId }).where(and(isNull(chronicles.authorUserId), namesMatch));

  const [{ n }] = await db
    .select({ n: count() })
    .from(chronicles)
    .where(and(eq(chronicles.authorUserId, userId), isNotNull(chronicles.legacySourceUrl)));
  return n;
}

/** The account with this real name and character (ignoring case), or null if there isn't one. */
export async function findUserByNames(playerName: string, characterName: string): Promise<number | null> {
  const [match] = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userCharacters, eq(userCharacters.userId, users.id))
    .where(
      and(
        sql`lower(trim(${users.playerName})) = ${playerName.trim().toLowerCase()}`,
        sql`lower(trim(${userCharacters.name})) = ${characterName.trim().toLowerCase()}`,
      ),
    )
    .limit(1);
  return match?.id ?? null;
}

/** First-time setup: real name plus one or more characters. */
export async function saveProfile(userId: number, playerName: string, characters: string[]) {
  await db.update(users).set({ playerName }).where(eq(users.id, userId));
  for (const name of characters) {
    await db.insert(userCharacters).values({ userId, name }).onConflictDoNothing();
  }
  return relinkImportedChronicles(userId);
}

/** Adds a character (no-op if they already have it, ignoring case). */
export async function addCharacter(userId: number, name: string) {
  await db.insert(userCharacters).values({ userId, name }).onConflictDoNothing();
  return relinkImportedChronicles(userId);
}

/** Removes a character, unless the person has chronicles written as that character. */
export async function removeCharacter(userId: number, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const counts = await chronicleCountsByCharacter(userId);
  if ((counts.get(name.trim().toLowerCase()) ?? 0) > 0) {
    return { ok: false, error: `You have chronicles written as ${name}, so it can't be removed.` };
  }
  await db
    .delete(userCharacters)
    .where(and(eq(userCharacters.userId, userId), sql`lower(${userCharacters.name}) = ${name.trim().toLowerCase()}`));
  await relinkImportedChronicles(userId);
  return { ok: true };
}
