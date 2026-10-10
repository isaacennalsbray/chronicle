"use client";

import { useActionState, useState } from "react";
import { type SubmitState, submitChronicle } from "./actions";

type SessionOption = { id: number; leagueId: number; label: string; group: string };

export function SubmitForm({
  leagues,
  sessions,
  defaultLeagueId,
  defaultSessionId,
  defaultYear,
  defaultPlayerName,
}: {
  leagues: { id: number; name: string }[];
  sessions: SessionOption[];
  defaultLeagueId: string;
  defaultSessionId: string;
  defaultYear: string;
  defaultPlayerName: string;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitChronicle, {});
  const v = state.values;
  const [leagueId, setLeagueId] = useState(v?.leagueId ?? defaultLeagueId);

  // Sessions of the chosen league, grouped by season.
  const groups = new Map<string, SessionOption[]>();
  for (const s of sessions.filter((s) => String(s.leagueId) === leagueId)) {
    groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  }

  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label htmlFor="leagueId" className="label">League</label>
        <select
          id="leagueId"
          name="leagueId"
          required
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          className="input"
        >
          <option value="" disabled>Choose a league…</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <div>
          <label htmlFor="sessionId" className="label">Session</label>
          <select
            key={leagueId}
            id="sessionId"
            name="sessionId"
            required
            disabled={!leagueId}
            defaultValue={v?.sessionId ?? defaultSessionId}
            className="input"
          >
            <option value="" disabled>{leagueId ? "Choose a session…" : "Choose a league first"}</option>
            {[...groups].map(([group, options]) => (
              <optgroup key={group} label={group}>
                {options.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="year" className="label">Year</label>
          <input
            id="year"
            name="year"
            type="number"
            inputMode="numeric"
            required
            min={2000}
            max={2100}
            defaultValue={v?.year ?? defaultYear}
            className="input"
          />
        </div>
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
        <label htmlFor="bodyText" className="label">Chronicle</label>
        <textarea id="bodyText" name="bodyText" required rows={18} defaultValue={v?.bodyText} className="input font-serif" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Submitting…" : "Submit for review"}</button>
    </form>
  );
}
