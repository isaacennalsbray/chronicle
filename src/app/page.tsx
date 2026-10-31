import Link from "next/link";
import { OLD_CHRONICLES_LEAGUE } from "@/lib/old-chronicles";
import { listLeaguesWithSeasons, seasonTitle } from "@/lib/queries";

export default async function Home() {
  const leagues = await listLeaguesWithSeasons();

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-serif text-4xl font-semibold">Chronicles</h1>
        <p className="mt-2 text-muted">
          Stories of each game day, written by the players who lived them.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {leagues.map(({ league, seasons }) => (
          <section key={league.id} className="rounded-lg border border-border bg-surface p-5">
            <h2 className="font-serif text-xl font-semibold">
              <Link href={`/leagues/${league.slug}`} className="hover:underline">{league.name}</Link>
            </h2>
            {league.slug === OLD_CHRONICLES_LEAGUE ? (
              <p className="mt-2 text-sm text-muted">Chronicles written later about seasons long past.</p>
            ) : seasons.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No seasons yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {seasons.map((season) => (
                  <li key={season.id}>
                    <Link href={`/leagues/${league.slug}/${season.slug}`} className="link">
                      {seasonTitle(season, league)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
