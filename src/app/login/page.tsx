import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import { LoginForm } from "./login-form";
import { PENDING_EMAIL_COOKIE } from "./pending-email";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, admin } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/";
  const adminOnly = admin === "1";
  const user = await getCurrentUser();

  if (user && (!adminOnly || user.isAdmin)) redirect(nextPath);

  if (user && adminOnly) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-2 font-serif text-3xl font-semibold">Admin sign-in</h1>
        <p className="mb-6 text-sm">
          You&apos;re signed in as <strong>{user.email}</strong>, which isn&apos;t an admin. Log out, then sign in with
          an admin email.
        </p>
        <form action={logout}>
          <button className="btn w-full">Log out</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 font-serif text-3xl font-semibold">{adminOnly ? "Admin sign-in" : "Log in"}</h1>
      <p className="mb-6 text-sm text-muted">
        {adminOnly
          ? "Enter your admin email. We'll email you a 6-digit passcode to type in."
          : "We'll email you a 6-digit code. No password needed — new emails get an account automatically."}
      </p>
      <LoginForm
        pendingEmail={(await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? null}
        next={nextPath}
        adminOnly={adminOnly}
      />
    </div>
  );
}
