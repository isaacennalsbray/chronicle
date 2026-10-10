"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
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
