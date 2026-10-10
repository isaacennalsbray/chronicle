import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { PENDING_EMAIL_COOKIE } from "./pending-email";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/";
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 font-serif text-3xl font-semibold">Log in</h1>
      <p className="mb-6 text-sm text-muted">
        We&apos;ll email you a 6-digit code. No password needed — new emails get an account automatically.
      </p>
      <LoginForm pendingEmail={(await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? null} next={nextPath} />
    </div>
  );
}
