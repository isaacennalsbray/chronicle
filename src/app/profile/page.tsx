import type { Metadata } from "next";
import { needsProfile, requireUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your names" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser();
  const { next } = await searchParams;
  const firstTime = needsProfile(user);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-3xl font-semibold">{firstTime ? "Welcome!" : "Your names"}</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your real name and the name of each character you play. Chronicles from the old site written under the
        same names will be added to your account.
      </p>
      <ProfileForm
        playerName={user.playerName ?? ""}
        characters={user.characters}
        next={typeof next === "string" ? next : "/me"}
      />
    </div>
  );
}
