"use client";

import { useActionState } from "react";
import { addCharacterAction, type EditState, removeCharacterAction } from "./actions";

function Feedback({ state }: { state: EditState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.message) return <p className="text-sm text-muted">{state.message}</p>;
  return null;
}

export function CharacterRow({ name, chronicleCount }: { name: string; chronicleCount: number }) {
  const [state, action, pending] = useActionState<EditState, FormData>(removeCharacterAction, {});
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="font-medium">{name}</span>
      {chronicleCount > 0 ? (
        <span className="text-sm text-muted">
          {chronicleCount} chronicle{chronicleCount === 1 ? "" : "s"}
        </span>
      ) : (
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="name" value={name} />
          <Feedback state={state} />
          <button className="btn-secondary" disabled={pending}>Remove</button>
        </form>
      )}
    </li>
  );
}

export function AddCharacterForm() {
  const [state, action, pending] = useActionState<EditState, FormData>(addCharacterAction, {});
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="newCharacter" className="label">Add a character</label>
      <div className="flex gap-2">
        <input id="newCharacter" name="name" required maxLength={100} placeholder="Character name" className="input" />
        <button className="btn" disabled={pending}>Add</button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
