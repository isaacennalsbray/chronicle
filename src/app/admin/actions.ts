"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
  playedOn: z.union([z.literal(""), z.iso.date()]),
});

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
      playedOn: playedOn || null,
      sortOrder: (last ?? 0) + 1,
    })
    .onConflictDoNothing()
    .returning({ id: schema.sessions.id });
  if (inserted.length === 0) return { error: "That season already has a session on that date." };

  revalidatePath("/admin");
  return { ok: true };
}

const InGameDate = z.object({
  sessionId: z.coerce.number().int().positive(),
  inGameDate: z.string().trim().min(1, "Enter the in-game date.").max(100),
});

export async function setInGameDate(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const parsed = InGameDate.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(schema.sessions)
    .set({ inGameDate: parsed.data.inGameDate })
    .where(eq(schema.sessions.id, parsed.data.sessionId));

  revalidatePath("/admin");
  return { ok: true };
}
