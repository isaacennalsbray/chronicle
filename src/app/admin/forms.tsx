"use client";

import { useActionState } from "react";
import { NO_AUTOCORRECT } from "@/lib/no-autocorrect";
import { type AdminFormState, createSeason, createSession } from "./actions";

function Status({ state, success }: { state: AdminFormState; success: string }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-muted">{success}</p>;
  return null;
}

export function NewSessionForm({ seasons }: { seasons: { id: number; label: string }[] }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createSession, {});
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
      <div>
        <label htmlFor="seasonId" className="label">Season</label>
        <select id="seasonId" name="seasonId" required defaultValue="" className="input">
          <option value="" disabled>Choose…</option>
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="inGameDate" className="label">In-game date</label>
        <input id="inGameDate" name="inGameDate" required placeholder="9th of Tenthmoon, 287.3.3" {...NO_AUTOCORRECT} className="input" />
      </div>
      <div>
        <label htmlFor="playedOn" className="label">Played on (optional)</label>
        <input id="playedOn" name="playedOn" inputMode="numeric" placeholder="month/day/year" {...NO_AUTOCORRECT} className="input" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button className="btn" disabled={pending}>Add session</button>
        <Status state={state} success="Session added." />
      </div>
    </form>
  );
}

export function NewSeasonForm({ leagues }: { leagues: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(createSeason, {});
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end">
      <div>
        <label htmlFor="leagueId" className="label">League</label>
        <select id="leagueId" name="leagueId" required defaultValue="" className="input">
          <option value="" disabled>Choose…</option>
          {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="label" className="label">Season</label>
        <input id="label" name="label" required placeholder="S15" {...NO_AUTOCORRECT} className="input" />
      </div>
      <div>
        <label htmlFor="codename" className="label">Codename (optional)</label>
        <input id="codename" name="codename" placeholder="Eldar" {...NO_AUTOCORRECT} className="input" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-3">
        <button className="btn" disabled={pending}>Add season</button>
        <Status state={state} success="Season added." />
      </div>
    </form>
  );
}
