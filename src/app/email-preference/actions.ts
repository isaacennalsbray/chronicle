"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";

/** Saves whether the person wants emails from the site ("yes" or "no"). */
export async function setEmailPreference(formData: FormData) {
  const user = await requireUser();
  const emailNotifications = formData.get("emails") === "yes";
  await db.update(schema.users).set({ emailNotifications }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
}
