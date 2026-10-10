"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { parseChronicleId } from "@/lib/slug";

export async function approveChronicle(formData: FormData) {
  await requireAdmin();
  const id = parseChronicleId(String(formData.get("id") ?? ""));
  if (!id) return;

  const [approved] = await db
    .update(schema.chronicles)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(schema.chronicles.id, id), eq(schema.chronicles.status, "pending")))
    .returning({ id: schema.chronicles.id, slug: schema.chronicles.slug });

  redirect(approved ? `/chronicles/${approved.id}-${approved.slug}` : "/admin");
}
