import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  byline,
  distinctTitle,
  formatPlayedOn,
  listLeaguesWithSeasons,
  listPendingChronicles,
  listSessionsMissingInGameDate,
  seasonTitle,
  sessionLabel,
} from "@/lib/queries";
import { chroniclePath } from "@/lib/slug";
import { InGameDateForm, NewSeasonForm, NewSessionForm } from "./forms";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [pending, leagues, undated] = await Promise.all([
    listPendingChronicles(),
    listLeaguesWithSeasons(),
    listSessionsMissingInGameDate(),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="font-serif text-3xl font-semibold">Awaiting approval</h1>
        {pending.length === 0 ? (
          <p className="mt-4 text-muted">Nothing to review.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {pending.map(({ chronicle, session, season, league }) => (
              <li key={chronicle.id} className="py-3">
                <Link href={chroniclePath(chronicle)} className="link font-medium">{byline(chronicle)}</Link>
                {distinctTitle(chronicle) && <span className="text-muted"> — {chronicle.title}</span>}
                <p className="text-sm text-muted">
                  {seasonTitle(season, league)} · {sessionLabel(session)} · submitted{" "}
                  {chronicle.submittedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {undated.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Sessions needing an in-game date</h2>
          <p className="mt-1 text-sm text-muted">
            These were created when a player submitted a chronicle for a new date. Until you fill them in, the site
            shows the real date instead.
          </p>
          <ul className="mt-4 space-y-4">
            {undated.map(({ session, season, league }) => (
              <li key={session.id}>
                <p className="font-medium">
                  {session.playedOn ? formatPlayedOn(session.playedOn) : "No date"}
                  <span className="font-normal text-muted"> · {seasonTitle(season, league)}</span>
                </p>
                <InGameDateForm sessionId={session.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-serif text-2xl font-semibold">Add a session</h2>
        <p className="mt-1 text-sm text-muted">
          Optional: sessions are also created automatically when a player submits for a new date.
        </p>
        <NewSessionForm
          seasons={leagues.flatMap(({ league, seasons }) =>
            seasons.map((s) => ({ id: s.id, label: seasonTitle(s, league) })),
          )}
        />
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Add a season</h2>
        <NewSeasonForm leagues={leagues.map(({ league }) => ({ id: league.id, name: league.name }))} />
      </section>
    </div>
  );
}
