"use client";

import { useActionState } from "react";
import { type SubmitState, submitChronicle } from "./actions";

type Group = { label: string; sessions: { id: number; label: string }[] };

export function SubmitForm({
  groups,
  defaultSessionId,
  defaultPlayerName,
}: {
  groups: Group[];
  defaultSessionId: string;
  defaultPlayerName: string;
}) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitChronicle, {});
  const v = state.values;

  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label htmlFor="sessionId" className="label">Session</label>
        <select id="sessionId" name="sessionId" required defaultValue={v?.sessionId ?? defaultSessionId} className="input">
          <option value="" disabled>Choose a game day…</option>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="characterName" className="label">Character name</label>
          <input id="characterName" name="characterName" required maxLength={100} defaultValue={v?.characterName} className="input" />
        </div>
        <div>
          <label htmlFor="playerName" className="label">Your name</label>
          <input id="playerName" name="playerName" required maxLength={100} defaultValue={v?.playerName ?? defaultPlayerName} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="title" className="label">Title</label>
        <input id="title" name="title" required maxLength={200} defaultValue={v?.title} className="input" />
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
