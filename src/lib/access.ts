import "server-only";
import type { CurrentUser } from "./auth";

/** Approved chronicles are public; pending ones are visible to their author and admins. */
export function canView(chronicle: { status: string; authorUserId: number | null }, user: CurrentUser | null) {
  if (chronicle.status === "approved") return true;
  if (!user) return false;
  return user.isAdmin || chronicle.authorUserId === user.id;
}
