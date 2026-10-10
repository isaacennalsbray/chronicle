"use client";

import { useActionState } from "react";
import { type AdminFormState, deleteSession } from "@/app/admin/actions";

export function DeleteSessionButton({ sessionId, label }: { sessionId: number; label: string }) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(deleteSession, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Delete the session "${label}"? This can't be undone.`)) e.preventDefault();
      }}
      className="flex items-baseline gap-2"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <button className="text-sm text-red-600 hover:underline" disabled={pending}>
        Delete session
      </button>
      {state.error && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}
