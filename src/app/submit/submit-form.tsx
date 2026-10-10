"use client";

import { useActionState } from "react";
import { type SubmitState, submitChronicle } from "./actions";

export function SubmitForm({
  leagues,
  defaultLeagueId,
  defaultDate,
  defaultPlayerName,
}: {
  leagues: { id: number; name: string }[];
  defaultLeagueId: string;
  defaultDate: string;
  defaultPlayerName: string;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitChronicle, {});
  const v = state.values;

  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label htmlFor="leagueId" className="label">League</label>
        <select id="leagueId" name="leagueId" required defaultValue={v?.leagueId ?? defaultLeagueId} className="input">
          <option value="" disabled>Choose a league…</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="characterName" className="label">Character name</label>
          <input id="characterName" name="characterName" required maxLength={100} defaultValue={v?.characterName} className="input" />
        </div>
        <div>
          <label htmlFor="playerName" className="label">Player name</label>
          <input id="playerName" name="playerName" required maxLength={100} defaultValue={v?.playerName ?? defaultPlayerName} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="playedOn" className="label">Date of the LARP event</label>
        <input id="playedOn" name="playedOn" type="date" required defaultValue={v?.playedOn ?? defaultDate} className="input" />
      </div>
      <div>
        <label htmlFor="bodyText" className="label">Chronicle</label>
        <textarea id="bodyText" name="bodyText" required rows={18} defaultValue={v?.bodyText} className="input font-serif" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</button>
    </form>
  );
}
