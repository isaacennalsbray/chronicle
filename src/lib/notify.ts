import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "./email";
import { adminEmails, appUrl } from "./env";
import { chronicleLabels, getChronicleById, listPendingChronicles, seasonTitle, sessionLabel } from "./queries";
import { chroniclePath } from "./slug";

/** Admins who get review emails: those in ADMIN_EMAILS who have said yes to emails. */
async function adminRecipients() {
  const admins = adminEmails();
  if (admins.length === 0) return [];
  const accounts = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(and(inArray(schema.users.email, admins), eq(schema.users.emailNotifications, true)));
  return accounts.map((u) => u.email);
}

/** Emails admins a digest of every chronicle currently awaiting approval. */
export async function sendPendingDigest() {
  const admins = await adminRecipients();
  if (admins.length === 0) return;

  const pending = await listPendingChronicles();
  if (pending.length === 0) return;
  const labels = await chronicleLabels(pending.map((p) => p.chronicle));

  const lines = pending.map(
    ({ chronicle, session, season, league }) =>
      `- ${labels.get(chronicle.id)}\n` +
      `  ${seasonTitle(season, league)}, ${sessionLabel(session)}\n` +
      `  ${appUrl()}${chroniclePath(chronicle)}`,
  );

  await sendEmail({
    to: admins,
    subject: `${pending.length} chronicle${pending.length === 1 ? "" : "s"} awaiting approval`,
    text:
      `These chronicles are waiting for review:\n\n${lines.join("\n\n")}\n\n` +
      `Log in and open each one to approve it.`,
  });
}

/** Tells the author their chronicle was approved or rejected, if they've opted in to emails. */
export async function sendReviewResult(chronicleId: number) {
  const row = await getChronicleById(chronicleId);
  const authorId = row?.chronicle.authorUserId;
  if (!row || !authorId) return;
  const { chronicle, session, season, league } = row;
  if (chronicle.status === "pending") return;

  const author = await db.query.users.findFirst({ where: eq(schema.users.id, authorId) });
  if (!author?.emailNotifications) return;

  const label = (await chronicleLabels([chronicle])).get(chronicle.id);
  const where = `${seasonTitle(season, league)}, ${sessionLabel(session)}`;
  const link = `${appUrl()}${chroniclePath(chronicle)}`;

  if (chronicle.status === "approved") {
    await sendEmail({
      to: author.email,
      subject: `Your chronicle was approved: ${label}`,
      text: `Your chronicle ${label} (${where}) has been approved and is now on the site:\n\n${link}`,
    });
  } else {
    await sendEmail({
      to: author.email,
      subject: `Your chronicle was not approved: ${label}`,
      text:
        `Your chronicle ${label} (${where}) was not approved.\n\n` +
        (chronicle.rejectionReason ? `Reason: ${chronicle.rejectionReason}\n\n` : "") +
        `You can see it here:\n\n${link}`,
    });
  }
}
