import { approveChronicle, rejectChronicle } from "./actions";

/** Admin Approve / Reject buttons, with an optional reason for rejecting. */
export function ReviewControls({ id, canReject = true }: { id: number; canReject?: boolean }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <form action={approveChronicle}>
        <input type="hidden" name="id" value={id} />
        <button className="btn">Approve</button>
      </form>
      {canReject && (
        <form action={rejectChronicle} className="flex flex-1 flex-wrap items-start gap-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor={`reason-${id}`} className="sr-only">Reason for rejecting (optional)</label>
          <textarea
            id={`reason-${id}`}
            name="reason"
            rows={1}
            maxLength={1000}
            placeholder="Reason for rejecting (optional)"
            className="input min-w-48 flex-1 py-1.5 text-sm"
          />
          <button className="btn-secondary">Reject</button>
        </form>
      )}
    </div>
  );
}
