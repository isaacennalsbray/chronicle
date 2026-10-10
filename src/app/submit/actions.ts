"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { sendPendingDigest } from "@/lib/notify";
import { chroniclePath, slugify } from "@/lib/slug";

const Submission = z.object({
  sessionId: z.coerce.number().int().positive({ error: "Choose a session." }),
  title: z.string().trim().min(1, "Enter a title.").max(200),
  characterName: z.string().trim().min(1, "Enter your character's name.").max(100),
  playerName: z.string().trim().min(1, "Enter your name.").max(100),
  bodyText: z.string().trim().min(1, "Paste your chronicle text.").max(200_000, "That's too long."),
});

export type SubmitState = { error?: string; values?: Record<string, string> };

export async function submitChronicle(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const user = await requireUser();
  const raw = Object.fromEntries(
    ["sessionId", "title", "characterName", "playerName", "bodyText"].map((k) => [k, String(formData.get(k) ?? "")]),
  );

  const parsed = Submission.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: raw };
  const data = parsed.data;

  const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, data.sessionId) });
  if (!session) return { error: "That session no longer exists.", values: raw };

  const [chronicle] = await db
    .insert(schema.chronicles)
    .values({
      ...data,
      slug: slugify(data.title),
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
