import "server-only";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { isAdminEmail, sessionSecret } from "./env";
import { getCharacters } from "./profile";

const SESSION_COOKIE = "chronicle_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: number;
  email: string;
  playerName: string | null;
  characters: string[];
  isAdmin: boolean;
};

export async function startSession(userId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionSecret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: number;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    userId = Number(payload.sub);
  } catch {
    return null;
  }

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    playerName: user.playerName,
    characters: await getCharacters(user.id),
    isAdmin: isAdminEmail(user.email),
  };
});

/** True until the person has given their real name and at least one character name. */
export function needsProfile(user: CurrentUser) {
  return !user.playerName || user.characters.length === 0;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export const ADMIN_SIGN_IN_PATH = "/login?admin=1&next=%2Fadmin";

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect(ADMIN_SIGN_IN_PATH);
  return user;
}
