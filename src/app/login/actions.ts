"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, startSession } from "@/lib/auth";
import { normalizeEmail, requestLoginCode, verifyLoginCode } from "@/lib/login-codes";

import { PENDING_EMAIL_COOKIE } from "./pending-email";

export type LoginState = { error?: string };

export async function requestCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.email().safeParse(normalizeEmail(String(formData.get("email") ?? "")));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const email = parsed.data;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const result = await requestLoginCode(email, ip);
  if (!result.ok) return { error: result.error };

  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/login",
    maxAge: 15 * 60,
  });
  return {};
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const jar = await cookies();
  const email = jar.get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) return { error: "Your login attempt expired. Start again." };

  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from the email." };

  const result = await verifyLoginCode(email, code);
  if (!result.ok) return { error: result.error };

  jar.delete({ name: PENDING_EMAIL_COOKIE, path: "/login" });
  await startSession(result.userId);
  redirect(safeNext(String(formData.get("next") ?? "")));
}

export async function restartLogin() {
  (await cookies()).delete({ name: PENDING_EMAIL_COOKIE, path: "/login" });
  redirect("/login");
}

export async function logout() {
  await endSession();
  redirect("/");
}

// Only allow same-site relative redirects after login.
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
