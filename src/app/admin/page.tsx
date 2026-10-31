import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  chronicleLabels,
  listLeaguesWithSeasons,
  listPendingChronicles,
  seasonTitle,
  sessionLabel,
} from "@/lib/queries";
import { chroniclePath } from "@/lib/slug";
import { ReviewControls } from "../chronicles/[id]/review-controls";
import { NewSeasonForm, NewSessionForm } from "./forms";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const [pending, leagues] = await Promise.all([listPendingChronicles(), listLeaguesWithSeasons()]);
  const labels = await chronicleLabels(pending.map((p) => p.chronicle));

  return (
    <div className="space-y-12">
      <section>
        <h1 className="font-serif text-3xl font-semibold">Awaiting approval</h1>
        {pending.length === 0 ? (
          <p className="mt-4 text-muted">Nothing to review.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {pending.map(({ chronicle, session, season, league }) => (
              <li key={chronicle.id} className="space-y-3 py-4">
                <div>
                  <Link href={chroniclePath(chronicle)} className="link font-medium">{labels.get(chronicle.id)}</Link>
                  <p className="text-sm text-muted">
                    {seasonTitle(season, league)} · {sessionLabel(session)} · submitted{" "}
                    {chronicle.submittedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </p>
                </div>
                <ReviewControls id={chronicle.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Add someone else&apos;s chronicle</h2>
        <p className="mt-1 text-sm text-muted">
          For chronicles sent to you another way. On the{" "}
          <Link href="/submit" className="link">submit page</Link>, choose &ldquo;Written by: Someone else&rdquo;.
        </p>
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
