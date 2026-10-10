import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listSessionOptions, seasonTitle } from "@/lib/queries";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = { title: "Submit a chronicle" };

export default async function SubmitPage({ searchParams }: PageProps<"/submit">) {
  const user = await requireUser();
  const { session } = await searchParams;
  const options = await listSessionOptions();

  // Group sessions under "Helios — Eldar Chronicles (S14 Helios)" style headings.
  const groups = new Map<string, { id: number; label: string }[]>();
  for (const { session: s, season, league } of options) {
    const key = seasonTitle(season, league);
    groups.set(key, [...(groups.get(key) ?? []), { id: s.id, label: s.inGameDate }]);
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">Submit a chronicle</h1>
      <p className="mt-2 text-sm text-muted">
        Paste your chronicle as plain text. An admin will review it before it appears publicly.
      </p>
      {groups.size === 0 ? (
        <p className="mt-6 text-muted">No sessions are open yet. Check back after an admin adds one.</p>
      ) : (
        <SubmitForm
          groups={[...groups].map(([label, sessions]) => ({ label, sessions }))}
          defaultSessionId={typeof session === "string" ? session : ""}
          defaultPlayerName={user.playerName ?? ""}
        />
      )}
    </div>
  );
}
