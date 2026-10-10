"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/auth";
import { getChronicleById } from "@/lib/queries";
import { parseChronicleId } from "@/lib/slug";

const { chronicles } = schema;

export async function approveChronicle(formData: FormData) {
  await requireAdmin();
  const id = parseChronicleId(String(formData.get("id") ?? ""));
  if (!id) return;

  // Approving also works on a previously rejected chronicle.
  const [approved] = await db
    .update(chronicles)
    .set({ status: "approved", approvedAt: new Date(), rejectedAt: null })
    .where(and(eq(chronicles.id, id), ne(chronicles.status, "approved")))
    .returning({ id: chronicles.id, slug: chronicles.slug });

  redirect(approved ? `/chronicles/${approved.id}-${approved.slug}` : "/admin");
}

/** Permanently removes a chronicle, along with its stored original file if it was imported. */
export async function deleteChronicle(formData: FormData) {
  await requireAdmin();
  const id = parseChronicleId(String(formData.get("id") ?? ""));
  if (!id) return;

  const row = await getChronicleById(id);
  if (!row) redirect("/admin");

  await db.delete(chronicles).where(eq(chronicles.id, id));
  if (row.chronicle.legacyFileUrl) {
    try {
      await del(row.chronicle.legacyFileUrl);
    } catch (err) {
      // The chronicle is already gone; a leftover file is harmless.
      console.error("Failed to delete legacy file", err);
    }
  }

  redirect(`/leagues/${row.league.slug}/${row.season.slug}`);
}

export async function rejectChronicle(formData: FormData) {
  await requireAdmin();
  const id = parseChronicleId(String(formData.get("id") ?? ""));
  if (!id) return;

  await db
    .update(chronicles)
    .set({ status: "rejected", rejectedAt: new Date() })
    .where(and(eq(chronicles.id, id), eq(chronicles.status, "pending")));

  redirect("/admin");
}
