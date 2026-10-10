"use client";

import { useActionState, useState } from "react";
import { type AdminFormState, updateSessionDescription } from "@/app/admin/actions";

/** The session's description, with an inline editor for admins. */
export function SessionDescription({
  sessionId,
  description,
  isAdmin,
}: {
  sessionId: number;
  description: string | null;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<AdminFormState, FormData>(async (prev, formData) => {
    const result = await updateSessionDescription(prev, formData);
    if (result.ok) setEditing(false); // close the editor once saved
    return result;
  }, {});

  if (editing) {
    return (
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="sessionId" value={sessionId} />
        <label htmlFor={`description-${sessionId}`} className="sr-only">What happened this session</label>
        <textarea
          id={`description-${sessionId}`}
          name="description"
          rows={5}
          maxLength={10_000}
          defaultValue={description ?? ""}
          placeholder="What happened this session…"
          autoFocus
          className="input font-serif"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <div className="flex gap-2">
          <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <>
      {description && <p className="mt-2 whitespace-pre-wrap font-serif leading-relaxed">{description}</p>}
      {isAdmin && (
        <div className="mt-1 flex items-baseline gap-4 text-sm">
          <button type="button" onClick={() => setEditing(true)} className="link">
            {description ? "Edit description" : "+ Add a description"}
          </button>
          {description && (
            // Saving an empty description removes it.
            <form
              action={action}
              onSubmit={(e) => {
                if (!confirm("Delete this session's description?")) e.preventDefault();
              }}
            >
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="description" value="" />
              <button className="text-red-600 hover:underline" disabled={pending}>Delete description</button>
            </form>
          )}
          {state.error && <span className="text-red-600">{state.error}</span>}
        </div>
      )}
    </>
  );
}
