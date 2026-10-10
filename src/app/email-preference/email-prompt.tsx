"use client";

import { useEffect, useRef } from "react";
import { setEmailPreference } from "./actions";

/** One-time pop-up asking a logged-in person whether they want emails from the site. */
export function EmailPrompt({ isAdmin }: { isAdmin: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="email-prompt-title"
      // Closing with Escape would leave the question unanswered; it reappears next visit.
      className="m-auto max-w-sm rounded-lg border border-border bg-background p-6 text-foreground backdrop:bg-black/50"
    >
      <h2 id="email-prompt-title" className="font-serif text-xl font-semibold">
        Would you like email updates?
      </h2>
      <p className="mt-2 text-sm text-muted">
        We&apos;ll email you when one of your chronicles is approved or rejected
        {isAdmin ? ", and whenever a chronicle is submitted for review" : ""}. You can change this any time on your
        Profile.
      </p>
      <form action={setEmailPreference} className="mt-5 flex gap-3">
        <button name="emails" value="yes" className="btn flex-1">Yes, email me</button>
        <button name="emails" value="no" className="btn-secondary flex-1">No thanks</button>
      </form>
    </dialog>
  );
}
