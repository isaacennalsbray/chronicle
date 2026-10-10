"use client";

import { dismissRejectedChronicle } from "./actions";

export function DismissButton({ id }: { id: number }) {
  return (
    <form
      action={dismissRejectedChronicle}
      onSubmit={(e) => {
        if (!confirm("Dismiss this rejected chronicle? It will be removed from your list.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-muted hover:underline">Dismiss</button>
    </form>
  );
}
