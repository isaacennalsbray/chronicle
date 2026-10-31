import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OLD_CHRONICLES_LEAGUE, OLD_CHRONICLES_SEASON } from "@/lib/old-chronicles";
import { listLeaguesWithSeasons, seasonTitle } from "@/lib/queries";

async function load(slug: string) {
  return (await listLeaguesWithSeasons()).find((l) => l.league.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/leagues/[league]">): Promise<Metadata> {
  const entry = await load((await params).league);
  return { title: entry?.league.name };
}

export default async function LeaguePage({ params }: PageProps<"/leagues/[league]">) {
  const entry = await load((await params).league);
  if (!entry) notFound();
  const { league, seasons } = entry;
  // Old Chronicles is one page: go straight to its only season.
  if (league.slug === OLD_CHRONICLES_LEAGUE) redirect(`/leagues/${league.slug}/${OLD_CHRONICLES_SEASON}`);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">{league.name}</h1>
      {seasons.length === 0 ? (
        <p className="mt-4 text-muted">No seasons yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {seasons.map((season) => (
            <li key={season.id}>
              <Link href={`/leagues/${league.slug}/${season.slug}`} className="link text-lg">
                {seasonTitle(season, league)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
