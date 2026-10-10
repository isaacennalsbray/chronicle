import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { byline, distinctTitle, getSeason, getSeasonListing, seasonTitle, sessionLabel } from "@/lib/queries";
import { chroniclePath } from "@/lib/slug";

type Props = PageProps<"/leagues/[league]/[season]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league, season } = await params;
  const found = await getSeason(league, season);
  return { title: found ? seasonTitle(found.season, found.league) : undefined };
}

export default async function SeasonPage({ params }: Props) {
  const { league: leagueSlug, season: seasonSlug } = await params;
  const found = await getSeason(leagueSlug, seasonSlug);
  if (!found) notFound();
  const { league, season } = found;
  const [listing, user] = await Promise.all([getSeasonListing(season.id), getCurrentUser()]);

  return (
    <div>
      <p className="text-sm text-muted">
        <Link href={`/leagues/${league.slug}`} className="link">{league.name}</Link>
      </p>
      <h1 className="mt-1 font-serif text-3xl font-semibold">{seasonTitle(season, league)}</h1>

      {listing.length === 0 && <p className="mt-6 text-muted">No sessions yet.</p>}

      <div className="mt-8 space-y-8">
        {listing.map(({ session, chronicles }) => {
          const submitPath = `/submit?league=${league.slug}${session.playedOn ? `&date=${session.playedOn}` : ""}`;
          return (
            <section key={session.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h2 className="font-serif text-xl font-semibold">{sessionLabel(session)}</h2>
                <Link
                  href={user ? submitPath : `/login?next=${encodeURIComponent(submitPath)}`}
                  className="link text-sm"
                >
                  {user ? "Submit a chronicle" : "Log in to submit"}
                </Link>
              </div>
              {chronicles.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No chronicles yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {chronicles.map((c) => {
                    const title = distinctTitle(c);
                    return (
                      <li key={c.id}>
                        <Link href={chroniclePath(c)} className="link">{byline(c)}</Link>
                        {title && <span className="text-muted"> — {title}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
