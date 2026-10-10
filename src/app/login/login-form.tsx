"use client";

import { useActionState } from "react";
import { type LoginState, requestCode, restartLogin, verifyCode } from "./actions";

export function LoginForm({ pendingEmail, next }: { pendingEmail: string | null; next: string }) {
  const [requestState, requestAction, requesting] = useActionState<LoginState, FormData>(requestCode, {});
  const [verifyState, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, {});

  if (!pendingEmail) {
    return (
      <form action={requestAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required autoFocus className="input" />
        </div>
        {requestState.error && <p className="text-sm text-red-600">{requestState.error}</p>}
        <button className="btn w-full" disabled={requesting}>
          {requesting ? "Sending…" : "Email me a code"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <form action={verifyAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <p className="text-sm">
          We sent a code to <strong>{pendingEmail}</strong>. It expires in 10 minutes.
        </p>
        <div>
          <label htmlFor="code" className="label">Code</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            className="input tracking-[0.4em]"
          />
        </div>
        {verifyState.error && <p className="text-sm text-red-600">{verifyState.error}</p>}
        <button className="btn w-full" disabled={verifying}>
          {verifying ? "Checking…" : "Log in"}
        </button>
      </form>
      <form action={restartLogin}>
        <button className="link text-sm">Use a different email or send a new code</button>
      </form>
    </div>
  );
}
