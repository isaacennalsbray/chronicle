import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { sessionSecret } from "./env";

const CODE_TTL_MINUTES = 10;
const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
const MAX_REQUESTS_PER_IP_PER_HOUR = 20;
const MAX_FAILED_ATTEMPTS = 5;

const { loginCodes, users } = schema;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashCode(email: string, code: string): string {
  return createHmac("sha256", sessionSecret()).update(`${email}:${code}`).digest("hex");
}

export type RequestCodeResult = { ok: true } | { ok: false; error: string };

export async function requestLoginCode(email: string, ip: string | null): Promise<RequestCodeResult> {
  const oneHourAgo = sql`now() - interval '1 hour'`;

  const [byEmail] = await db
    .select({ n: count() })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, oneHourAgo)));
  if (byEmail.n >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
    return { ok: false, error: "Too many codes requested for this email. Try again in an hour." };
  }

  if (ip) {
    const [byIp] = await db
      .select({ n: count() })
      .from(loginCodes)
      .where(and(eq(loginCodes.requestIp, ip), gt(loginCodes.createdAt, oneHourAgo)));
    if (byIp.n >= MAX_REQUESTS_PER_IP_PER_HOUR) {
      return { ok: false, error: "Too many login attempts. Try again later." };
    }
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.insert(loginCodes).values({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
    requestIp: ip,
  });

  await sendEmail({
    to: email,
    subject: `Your Chronicles login code: ${code}`,
    text:
      `Your login code is ${code}\n\n` +
      `It expires in ${CODE_TTL_MINUTES} minutes. If you didn't request it, you can ignore this email.`,
  });
  return { ok: true };
}

export type VerifyCodeResult = { ok: true; userId: number } | { ok: false; error: string };

export async function verifyLoginCode(email: string, code: string): Promise<VerifyCodeResult> {
  // Only the most recent live code counts; requesting a new code supersedes older ones.
  const latest = await db.query.loginCodes.findFirst({
    where: and(
      eq(loginCodes.email, email),
      isNull(loginCodes.consumedAt),
      gt(loginCodes.expiresAt, sql`now()`),
    ),
    orderBy: desc(loginCodes.createdAt),
  });

  if (!latest || latest.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    return { ok: false, error: "That code has expired. Request a new one." };
  }

  const expected = Buffer.from(latest.codeHash, "hex");
  const actual = Buffer.from(hashCode(email, code.trim()), "hex");
  if (!timingSafeEqual(expected, actual)) {
    await db
      .update(loginCodes)
      .set({ failedAttempts: sql`${loginCodes.failedAttempts} + 1` })
      .where(eq(loginCodes.id, latest.id));
    return { ok: false, error: "That code is incorrect." };
  }

  // Consume atomically so a code can't be used twice in a race.
  const consumed = await db
    .update(loginCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(loginCodes.id, latest.id), isNull(loginCodes.consumedAt)))
    .returning({ id: loginCodes.id });
  if (consumed.length === 0) {
    return { ok: false, error: "That code has already been used. Request a new one." };
  }

  const [user] = await db
    .insert(users)
    .values({ email })
    .onConflictDoUpdate({ target: users.email, set: { email } })
    .returning({ id: users.id });
  return { ok: true, userId: user.id };
}
