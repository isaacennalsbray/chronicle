import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  byline,
  distinctTitle,
  listLeaguesWithSeasons,
  listPendingChronicles,
  seasonTitle,
  sessionLabel,
} from "@/lib/queries";
import { chroniclePath } from "@/lib/slug";
import { NewSeasonForm, NewSessionForm } from "./forms";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [pending, leagues] = await Promise.all([listPendingChronicles(), listLeaguesWithSeasons()]);

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

      <section>
        <h2 className="font-serif text-2xl font-semibold">Add a session</h2>
        <p className="mt-1 text-sm text-muted">
          Players pick from these sessions when submitting.
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
