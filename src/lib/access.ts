import "server-only";
import type { CurrentUser } from "./auth";

/** Approved chronicles are public; pending ones are visible to their author and admins. */
export function canView(chronicle: { status: string; authorUserId: number | null }, user: CurrentUser | null) {
  if (chronicle.status === "approved") return true;
  if (!user) return false;
  return user.isAdmin || chronicle.authorUserId === user.id;
}

/**
 * Original files (scans, recordings) and PDFs need a login, even for approved chronicles. They're
 * big, and crawlers downloading every one of them used up the free hosting allowance; crawlers
 * can't log in. The text of a chronicle stays public.
 */
export function canDownload(chronicle: { status: string; authorUserId: number | null }, user: CurrentUser | null) {
  return user !== null && canView(chronicle, user);
}
