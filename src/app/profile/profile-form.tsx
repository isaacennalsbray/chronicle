"use client";

import { useActionState, useState } from "react";
import { type ProfileState, updateProfile } from "./actions";

export function ProfileForm({
  playerName,
  characters,
  next,
}: {
  playerName: string;
  characters: string[];
  next: string;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  // Keys keep inputs stable while rows are added and removed.
  const [rows, setRows] = useState(() =>
    (characters.length > 0 ? characters : [""]).map((name, i) => ({ key: i, name })),
  );

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="next" value={next} />
      {playerName ? (
        <div>
          <p className="label">Real name</p>
          <p>{playerName}</p>
        </div>
      ) : (
        <div>
          <label htmlFor="playerName" className="label">Real name</label>
          <input id="playerName" name="playerName" required maxLength={100} className="input" />
          <p className="mt-1 text-sm text-muted">This can&apos;t be changed later, so check it&apos;s right.</p>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="label">Character names</legend>
        {rows.map((row, i) => (
          <div key={row.key} className="flex gap-2">
            <input
              name="character"
              aria-label={`Character ${i + 1}`}
              required={i === 0}
              maxLength={100}
              defaultValue={row.name}
              className="input"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                className="btn-secondary"
                aria-label={`Remove character ${i + 1}`}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows([...rows, { key: Math.max(...rows.map((r) => r.key)) + 1, name: "" }])}
          className="link text-sm"
        >
          + Add another character
        </button>
      </fieldset>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}
