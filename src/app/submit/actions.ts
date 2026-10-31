"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { realDateFromInGameDate } from "@/lib/moons";
import { sendPendingDigest } from "@/lib/notify";
import { addCharacter, findUserByNames } from "@/lib/profile";
import { byline } from "@/lib/queries";
import { chroniclePath, slugify } from "@/lib/slug";

const Submission = z.object({
  sessionId: z.coerce.number().int().positive({ error: "Choose a session." }),
  year: z.coerce.number().int().min(2000, "Enter a valid year.").max(2100, "Enter a valid year."),
  character: z.string(),
  newCharacter: z.string().trim().max(100),
  // Admins can add a chronicle someone else wrote ("other"), typing in that person's names.
  author: z.enum(["me", "other"]).catch("me"),
  otherPlayer: z.string().trim().max(100),
  otherCharacter: z.string().trim().max(100),
  bodyText: z.string().trim().min(1, "Paste your chronicle text.").max(200_000, "That's too long."),
});

export type SubmitState = { error?: string; values?: Record<string, string> };

// Value of the "Add a new character" choice in the character box.
const NEW_CHARACTER = "__new__";

export async function submitChronicle(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const raw = Object.fromEntries(
    [
      "leagueId",
      "sessionId",
      "year",
      "character",
      "newCharacter",
      "author",
      "otherPlayer",
      "otherCharacter",
      "bodyText",
    ].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );

  const parsed = Submission.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: raw };
  const { sessionId, year, character, newCharacter, author, otherPlayer, otherCharacter, bodyText } = parsed.data;
  const forSomeoneElse = user.isAdmin && author === "other";

  let data: { characterName: string; playerName: string; bodyText: string };
  let isNewCharacter = false;
  if (forSomeoneElse) {
    if (!otherPlayer) return { error: "Enter the player's name.", values: raw };
    if (!otherCharacter) return { error: "Enter their character's name.", values: raw };
    data = { characterName: otherCharacter, playerName: otherPlayer, bodyText };
  } else {
    if (!user.playerName) redirect("/profile?next=%2Fsubmit");
    if (!character) return { error: "Choose your character.", values: raw };
    const characterName = character === NEW_CHARACTER ? newCharacter : character;
    if (!characterName) return { error: "Enter the new character's name.", values: raw };
    isNewCharacter = !user.characters.some((c) => c.toLowerCase() === characterName.toLowerCase());
    data = { characterName, playerName: user.playerName, bodyText };
  }

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
      // An admin adding someone else's chronicle has already read it, so it goes live at once.
      // It's linked to the writer's account if they have one; otherwise it joins their account
      // when they sign up with the same names, like an imported chronicle.
      ...(forSomeoneElse
        ? {
            authorUserId: await findUserByNames(data.playerName, data.characterName),
            status: "approved" as const,
            approvedAt: new Date(),
          }
        : { authorUserId: user.id, status: "pending" as const }),
    })
    .returning({ id: schema.chronicles.id, slug: schema.chronicles.slug });

  if (forSomeoneElse) {
    revalidatePath("/", "layout");
    redirect(chroniclePath(chronicle));
  }

  // A character typed in here joins their profile, like adding it there.
  if (isNewCharacter) await addCharacter(user.id, data.characterName);

  try {
    await sendPendingDigest();
  } catch (err) {
    // The submission is saved; a failed notification shouldn't lose it.
    console.error("Failed to send pending digest", err);
  }

  redirect(chroniclePath(chronicle));
}
