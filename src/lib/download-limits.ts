import "server-only";
import { eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const MB = 1_000_000;
// Each download goes Blob → our function → browser, so it counts against Vercel's free Blob Data
// Transfer and Fast Origin Transfer (10 GB a month each). The site-wide cap is the real guarantee:
// 300 MB × 31 days is about 9.3 GB, so even someone with many accounts can't use the month up.
export const USER_DAILY_BYTES = 200 * MB;
export const SITE_DAILY_BYTES = 300 * MB;

export type LimitHit = "account" | "site";

/**
 * Records a download of `bytes`, unless it would take this account or the whole site past its
 * limit for the last 24 hours. Records first and checks afterwards, so two downloads at the same
 * moment can't both slip under the limit: whichever finds the total too high removes its own row.
 */
export async function claimDownload(userId: number, chronicleId: number, bytes: number): Promise<LimitHit | null> {
  const [row] = await db
    .insert(schema.downloads)
    .values({ userId, chronicleId, bytes })
    .returning({ id: schema.downloads.id });

  const since = sql`now() - interval '24 hours'`;
  const [totals] = await db
    .select({
      site: sql<number>`coalesce(sum(${schema.downloads.bytes}), 0)::bigint`.mapWith(Number),
      mine: sql<number>`coalesce(sum(${schema.downloads.bytes}) filter (where ${schema.downloads.userId} = ${userId}), 0)::bigint`.mapWith(Number),
    })
    .from(schema.downloads)
    .where(gt(schema.downloads.createdAt, since));

  const hit: LimitHit | null =
    totals.mine > USER_DAILY_BYTES ? "account" : totals.site > SITE_DAILY_BYTES ? "site" : null;
  if (hit) await db.delete(schema.downloads).where(eq(schema.downloads.id, row.id));
  return hit;
}

export const LIMIT_MESSAGES: Record<LimitHit, string> = {
  account: "You've downloaded 200 MB of files in the last 24 hours, which is the daily limit. Try again tomorrow.",
  site: "So many files have been downloaded from the site today that downloads are paused until tomorrow. The text of every chronicle is still here to read.",
};
