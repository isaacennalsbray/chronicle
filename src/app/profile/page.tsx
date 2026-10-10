import type { Metadata } from "next";
import { needsProfile, requireUser } from "@/lib/auth";
import { chronicleCountsByCharacter } from "@/lib/profile";
import { setEmailPreference } from "../email-preference/actions";
import { AddCharacterForm, CharacterRow } from "./profile-editor";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser();
  const { next } = await searchParams;

  // First sign-in: one form for real name and characters.
  if (needsProfile(user)) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="font-serif text-3xl font-semibold">Welcome!</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your real name and the name of each character you play. Chronicles already written under the same
          names will be added to your account.
        </p>
        <ProfileForm
          playerName={user.playerName ?? ""}
          characters={user.characters}
          next={typeof next === "string" ? next : "/me"}
        />
      </div>
    );
  }

  const counts = await chronicleCountsByCharacter(user.id);

  return (
    <div className="mx-auto max-w-md space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>

      <div>
        <p className="label">Real name</p>
        <p>{user.playerName}</p>
      </div>

      <section>
        <h2 className="label">Characters</h2>
        <p className="text-sm text-muted">
          Characters you&apos;ve written chronicles as can&apos;t be removed. Adding a character also adds any chronicles
          already written under it and your real name.
        </p>
        <ul className="mt-2 divide-y divide-border">
          {user.characters.map((name) => (
            <CharacterRow key={name} name={name} chronicleCount={counts.get(name.trim().toLowerCase()) ?? 0} />
          ))}
        </ul>
      </section>

      <AddCharacterForm />

      <section>
        <h2 className="label">Email updates</h2>
        <p className="text-sm text-muted">
          {user.emailNotifications
            ? `You're getting emails when your chronicles are approved or rejected${user.isAdmin ? ", and when chronicles are submitted for review" : ""}.`
            : "You're not getting emails from the site."}
        </p>
        <form action={setEmailPreference} className="mt-2">
          <button name="emails" value={user.emailNotifications ? "no" : "yes"} className="btn-secondary">
            {user.emailNotifications ? "Turn off emails" : "Turn on emails"}
          </button>
        </form>
      </section>
    </div>
  );
}
