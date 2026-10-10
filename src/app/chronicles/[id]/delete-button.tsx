"use client";

import { deleteChronicle } from "./actions";

export function DeleteButton({ id, title }: { id: number; title: string }) {
  return (
    <form
      action={deleteChronicle}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete "${title}"? This can't be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-secondary text-red-600">Delete</button>
    </form>
  );
}
