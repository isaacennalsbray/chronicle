"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { realDateFromInGameDate } from "@/lib/moons";
import { sendPendingDigest } from "@/lib/notify";
import { addCharacter } from "@/lib/profile";
import { byline } from "@/lib/queries";
import { chroniclePath, slugify } from "@/lib/slug";

const Submission = z.object({
  sessionId: z.coerce.number().int().positive({ error: "Choose a session." }),
  year: z.coerce.number().int().min(2000, "Enter a valid year.").max(2100, "Enter a valid year."),
  character: z.string().min(1, "Choose your character."),
  newCharacter: z.string().trim().max(100),
  bodyText: z.string().trim().min(1, "Paste your chronicle text.").max(200_000, "That's too long."),
});

export type SubmitState = { error?: string; values?: Record<string, string> };

// Value of the "Add a new character" choice in the character box.
const NEW_CHARACTER = "__new__";

export async function submitChronicle(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const raw = Object.fromEntries(
    ["leagueId", "sessionId", "year", "character", "newCharacter", "bodyText"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );

  const parsed = Submission.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: raw };
  const { sessionId, year, character, newCharacter, bodyText } = parsed.data;

  if (!user.playerName) redirect("/profile?next=%2Fsubmit");
  const characterName = character === NEW_CHARACTER ? newCharacter : character;
  if (!characterName) return { error: "Enter the new character's name.", values: raw };
  const isNewCharacter = !user.characters.some((c) => c.toLowerCase() === characterName.toLowerCase());
  const data = { characterName, playerName: user.playerName, bodyText };

  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
  if (!session) return { error: "That session no longer exists.", values: raw };

  // "9th of Tenthmoon" + 2026 → 2026-10-09.
  const eventDate = session.inGameDate ? realDateFromInGameDate(session.inGameDate, year) : session.playedOn;
  if (!eventDate) return { error: `${session.inGameDate} doesn't exist in ${year}. Check the year.`, values: raw };

  const title = byline(data);
  const [chronicle] = await db
    .insert(schema.chronicles)
    .values({
      ...data,
      sessionId,
      eventDate,
      title,
      slug: slugify(title),
      authorUserId: user.id,
      status: "pending",
    })
    .returning({ id: schema.chronicles.id, slug: schema.chronicles.slug });

  // A character typed in here joins their profile, like adding it there.
  if (isNewCharacter) await addCharacter(user.id, characterName);

  try {
    await sendPendingDigest();
  } catch (err) {
    // The submission is saved; a failed notification shouldn't lose it.
    console.error("Failed to send pending digest", err);
  }

  redirect(chroniclePath(chronicle));
}
