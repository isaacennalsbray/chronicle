"use client";

import { useActionState } from "react";
import { type AdminFormState, deleteSeason } from "@/app/admin/actions";

export function DeleteSeasonButton({ seasonId, label }: { seasonId: number; label: string }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(deleteSeason, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete the season "${label}" and its empty sessions? This can't be undone.`)) e.preventDefault();
      }}
      className="flex flex-wrap items-baseline gap-2"
    >
      <input type="hidden" name="seasonId" value={seasonId} />
      <button className="text-sm text-red-600 hover:underline" disabled={pending}>
        Delete season
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
