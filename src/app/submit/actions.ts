"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { sendPendingDigest } from "@/lib/notify";
import { byline, findOrCreateSessionByDate } from "@/lib/queries";
import { chroniclePath, slugify } from "@/lib/slug";

const Submission = z.object({
  leagueId: z.coerce.number().int().positive({ error: "Choose a league." }),
  playedOn: z.iso.date({ error: "Enter the date of the LARP event." }),
  characterName: z.string().trim().min(1, "Enter your character's name.").max(100),
  playerName: z.string().trim().min(1, "Enter your name.").max(100),
  bodyText: z.string().trim().min(1, "Paste your chronicle text.").max(200_000, "That's too long."),
});

export type SubmitState = { error?: string; values?: Record<string, string> };

export async function submitChronicle(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const raw = Object.fromEntries(
    ["leagueId", "playedOn", "characterName", "playerName", "bodyText"].map((k) => [k, String(formData.get(k) ?? "")]),
  );

  const parsed = Submission.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: raw };
  const { leagueId, playedOn, ...data } = parsed.data;

  // Allow a day of slack for time zones.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (playedOn > tomorrow) return { error: "The event date can't be in the future.", values: raw };

  const league = await db.query.leagues.findFirst({ where: eq(schema.leagues.id, leagueId) });
  if (!league) return { error: "Choose a league.", values: raw };

  const session = await findOrCreateSessionByDate(league.id, playedOn);
  if (!session) {
    return { error: `${league.name} doesn't have a season set up yet. Please contact an admin.`, values: raw };
  }

  const title = byline(data);
  const [chronicle] = await db
    .insert(schema.chronicles)
    .values({
      ...data,
      sessionId: session.id,
      title,
      slug: slugify(title),
      authorUserId: user.id,
      status: "pending",
    })
    .returning({ id: schema.chronicles.id, slug: schema.chronicles.slug });

  if (user.playerName !== data.playerName) {
    await db.update(schema.users).set({ playerName: data.playerName }).where(eq(schema.users.id, user.id));
  }

  try {
    await sendPendingDigest();
  } catch (err) {
    // The submission is saved; a failed notification shouldn't lose it.
    console.error("Failed to send pending digest", err);
  }

  redirect(chroniclePath(chronicle));
}
