import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { needsProfile, requireUser } from "@/lib/auth";
import { listLeagues, listSessionOptions, seasonTitle, sessionLabel } from "@/lib/queries";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Submit a chronicle" };

export default async function SubmitPage({ searchParams }: PageProps<"/submit">) {
  const user = await requireUser();
  const { session: sessionParam } = await searchParams;
  if (needsProfile(user)) {
    const back = `/submit${typeof sessionParam === "string" ? `?session=${sessionParam}` : ""}`;
    redirect(`/profile?next=${encodeURIComponent(back)}`);
  }
  const [leagues, options] = await Promise.all([listLeagues(), listSessionOptions()]);

  const sessions = options.map(({ session, season, league }) => ({
    id: session.id,
    leagueId: league.id,
    label: sessionLabel(session),
    group: seasonTitle(season, league),
  }));
  const preselected = sessions.find((s) => String(s.id) === sessionParam);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Submit a chronicle</h1>
      <p className="mt-2 text-sm text-muted">
        Paste your chronicle as plain text. An admin will review it before it appears publicly.
      </p>
      <SubmitForm
        leagues={leagues.map((l) => ({ id: l.id, name: l.name }))}
        sessions={sessions}
        defaultLeagueId={preselected ? String(preselected.leagueId) : ""}
        defaultSessionId={preselected ? String(preselected.id) : ""}
        defaultYear={String(new Date().getFullYear())}
        characters={user.characters}
        isAdmin={user.isAdmin}
      />
    </div>
  );
}
