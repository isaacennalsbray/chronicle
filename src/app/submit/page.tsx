import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listLeagues } from "@/lib/queries";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Submit a chronicle" };

export default async function SubmitPage({ searchParams }: PageProps<"/submit">) {
  const user = await requireUser();
  const { league, date } = await searchParams;
  const leagues = await listLeagues();
  const defaultLeague = leagues.find((l) => l.slug === league);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Submit a chronicle</h1>
      <p className="mt-2 text-sm text-muted">
        Paste your chronicle as plain text. An admin will review it before it appears publicly.
      </p>
      <SubmitForm
        leagues={leagues.map((l) => ({ id: l.id, name: l.name }))}
        defaultLeagueId={defaultLeague ? String(defaultLeague.id) : ""}
        defaultDate={typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""}
        defaultPlayerName={user.playerName ?? ""}
      />
    </div>
  );
}
