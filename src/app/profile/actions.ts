"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { addCharacter, removeCharacter, saveProfile } from "@/lib/profile";

export type ProfileState = { error?: string };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser();
  // The real name can only be set once; after that it stays fixed.
  const playerName = user.playerName ?? String(formData.get("playerName") ?? "").trim().slice(0, 100);
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

export type EditState = { error?: string; message?: string };

export async function addCharacterAction(_prev: EditState, formData: FormData): Promise<EditState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Enter a character name." };
  if (user.characters.some((c) => c.toLowerCase() === name.toLowerCase())) {
    return { error: `You already have ${name}.` };
  }
  const linked = await addCharacter(user.id, name);
  revalidatePath("/", "layout");
  return { message: linkedMessage(`Added ${name}.`, linked) };
}

export async function removeCharacterAction(_prev: EditState, formData: FormData): Promise<EditState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");
  const result = await removeCharacter(user.id, name);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return {};
}

function linkedMessage(prefix: string, linked: number) {
  return linked > 0
    ? `${prefix} ${linked} chronicle${linked === 1 ? "" : "s"} from the old site ${linked === 1 ? "is" : "are"} linked to your account.`
    : prefix;
}
