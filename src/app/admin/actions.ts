"use server";

import { count, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export type AdminFormState = { error?: string; ok?: boolean };

const NewSeason = z.object({
  leagueId: z.coerce.number().int().positive({ error: "Choose a league." }),
  label: z.string().trim().min(1, "Enter a season label, e.g. S15.").max(20),
  codename: z.string().trim().max(60),
});

export async function createSeason(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const parsed = NewSeason.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { leagueId, label, codename } = parsed.data;

  const inserted = await db
    .insert(schema.seasons)
    .values({ leagueId, label, slug: slugify(label), codename: codename || null })
    .onConflictDoNothing()
    .returning({ id: schema.seasons.id });
  if (inserted.length === 0) return { error: `That league already has a season ${label}.` };

  revalidatePath("/admin");
  return { ok: true };
}

const NewSession = z.object({
  seasonId: z.coerce.number().int().positive({ error: "Choose a season." }),
  inGameDate: z.string().trim().min(1, "Enter the in-game date.").max(100),
  // Typed as month/day/year, e.g. 10/9/2026.
  playedOn: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (!value) return null;
      const iso = isoFromMonthDayYear(value);
      if (!iso) ctx.addIssue({ code: "custom", message: "Enter the date as month/day/year, e.g. 10/9/2026." });
      return iso;
    }),
});

/** "10/9/2026" → "2026-10-09", or null if it isn't a real date. */
function isoFromMonthDayYear(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

export async function createSession(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const parsed = NewSession.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { seasonId, inGameDate, playedOn } = parsed.data;

  const [{ last }] = await db
    .select({ last: max(schema.sessions.sortOrder) })
    .from(schema.sessions)
    .where(eq(schema.sessions.seasonId, seasonId));

  const inserted = await db
    .insert(schema.sessions)
    .values({
      seasonId,
      inGameDate,
      playedOn,
      sortOrder: (last ?? 0) + 1,
    })
    .onConflictDoNothing()
    .returning({ id: schema.sessions.id });
  if (inserted.length === 0) return { error: "That season already has a session on that date." };

  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteSession(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const sessionId = Number(formData.get("sessionId"));
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return { error: "Unknown session." };

  // Never take chronicles down with a session; counts hidden (pending/rejected) ones too.
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.chronicles)
    .where(eq(schema.chronicles.sessionId, sessionId));
  if (n > 0) {
    return { error: `This session still has ${n} chronicle${n === 1 ? "" : "s"}. Delete or move them first.` };
  }

  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  revalidatePath("/leagues/[league]/[season]", "page");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteSeason(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const seasonId = Number(formData.get("seasonId"));
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) return { error: "Unknown season." };

  const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.id, seasonId) });
  if (!season) return { error: "That season no longer exists." };
  const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, season.leagueId) });

  // Counts hidden (pending/rejected) chronicles too, so nothing is lost with the season.
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.chronicles)
    .innerJoin(schema.sessions, eq(schema.chronicles.sessionId, schema.sessions.id))
    .where(eq(schema.sessions.seasonId, seasonId));
  if (n > 0) {
    return { error: `This season still has ${n} chronicle${n === 1 ? "" : "s"}. Delete them first.` };
  }

  await db.delete(schema.sessions).where(eq(schema.sessions.seasonId, seasonId));
  await db.delete(schema.seasons).where(eq(schema.seasons.id, seasonId));
  revalidatePath("/", "layout");
  redirect(league ? `/leagues/${league.slug}` : "/");
}
