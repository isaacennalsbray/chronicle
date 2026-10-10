"use client";

import { useActionState, useState } from "react";
import { type SubmitState, submitChronicle } from "./actions";

// Matches NEW_CHARACTER in ./actions.
const NEW_CHARACTER = "__new__";

type SessionOption = { id: number; leagueId: number; label: string; group: string };

export function SubmitForm({
  leagues,
  sessions,
  defaultLeagueId,
  defaultSessionId,
  defaultYear,
  characters,
}: {
  leagues: { id: number; name: string }[];
  sessions: SessionOption[];
  defaultLeagueId: string;
  defaultSessionId: string;
  defaultYear: string;
  characters: string[];
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitChronicle, {});
  const v = state.values;
  const [leagueId, setLeagueId] = useState(v?.leagueId ?? defaultLeagueId);
  const [character, setCharacter] = useState(v?.character ?? characters[0] ?? NEW_CHARACTER);

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
      <div className="space-y-2">
        <label htmlFor="character" className="label">Character</label>
        <select
          id="character"
          name="character"
          required
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
          className="input"
        >
          {characters.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          <option value={NEW_CHARACTER}>+ Add a new character…</option>
        </select>
        {character === NEW_CHARACTER && (
          <input
            name="newCharacter"
            aria-label="New character name"
            required
            autoFocus
            maxLength={100}
            placeholder="New character name"
            defaultValue={v?.newCharacter}
            className="input"
          />
        )}
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
