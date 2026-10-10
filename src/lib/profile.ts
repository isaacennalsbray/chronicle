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

/**
 * Saves a person's real name and character names, then links every imported chronicle with
 * that real name and one of those characters to them (and unlinks imported ones that no longer
 * match). Imported chronicles already linked to someone else are left alone.
 * Returns how many imported chronicles are now theirs.
 */
export async function saveProfile(userId: number, playerName: string, characters: string[]) {
  const unique = [...new Map(characters.map((c) => [c.toLowerCase(), c])).values()];

  await db.update(users).set({ playerName }).where(eq(users.id, userId));
  await db.delete(userCharacters).where(eq(userCharacters.userId, userId));
  if (unique.length > 0) {
    await db.insert(userCharacters).values(unique.map((name) => ({ userId, name })));
  }

  const lowered = unique.map((c) => c.toLowerCase());
  const matches = and(
    isNotNull(chronicles.legacySourceUrl),
    sql`lower(trim(${chronicles.playerName})) = ${playerName.toLowerCase()}`,
    lowered.length > 0 ? inArray(sql`lower(trim(${chronicles.characterName}))`, lowered) : sql`false`,
  );

  await db
    .update(chronicles)
    .set({ authorUserId: null })
    .where(and(eq(chronicles.authorUserId, userId), isNotNull(chronicles.legacySourceUrl), not(matches!)));
  await db.update(chronicles).set({ authorUserId: userId }).where(and(isNull(chronicles.authorUserId), matches));

  const [{ n }] = await db
    .select({ n: count() })
    .from(chronicles)
    .where(and(eq(chronicles.authorUserId, userId), isNotNull(chronicles.legacySourceUrl)));
  return n;
}
