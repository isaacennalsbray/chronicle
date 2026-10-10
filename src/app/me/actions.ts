"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { parseChronicleId } from "@/lib/slug";

const { chronicles } = schema;

/** Lets an author clear away one of their own rejected chronicles. */
export async function dismissRejectedChronicle(formData: FormData) {
  const user = await requireUser();
  const id = parseChronicleId(String(formData.get("id") ?? ""));
  if (!id) return;

  await db
    .delete(chronicles)
    .where(and(eq(chronicles.id, id), eq(chronicles.authorUserId, user.id), eq(chronicles.status, "rejected")));

  revalidatePath("/me");
}
