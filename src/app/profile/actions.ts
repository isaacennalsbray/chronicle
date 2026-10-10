"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { saveProfile } from "@/lib/profile";

export type ProfileState = { error?: string };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const playerName = String(formData.get("playerName") ?? "").trim().slice(0, 100);
  const characters = formData
    .getAll("character")
    .map((c) => String(c).trim().slice(0, 100))
    .filter(Boolean);

  if (!playerName) return { error: "Enter your real name." };
  if (characters.length === 0) return { error: "Enter at least one character name." };

  const linked = await saveProfile(user.id, playerName, characters);

  const next = String(formData.get("next") ?? "");
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/me";
  const separator = destination.includes("?") ? "&" : "?";
  redirect(`${destination}${separator}linked=${linked}`);
}
