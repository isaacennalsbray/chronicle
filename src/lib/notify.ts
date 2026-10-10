import "server-only";
import { sendEmail } from "./email";
import { adminEmails, appUrl } from "./env";
import { byline, listPendingChronicles, seasonTitle } from "./queries";
import { chroniclePath } from "./slug";

/** Emails admins a digest of every chronicle currently awaiting approval. */
export async function sendPendingDigest() {
  const admins = adminEmails();
  if (admins.length === 0) return;

  const pending = await listPendingChronicles();
  if (pending.length === 0) return;

  const lines = pending.map(
    ({ chronicle, session, season, league }) =>
      `- ${chronicle.title} — ${byline(chronicle)}\n` +
      `  ${seasonTitle(season, league)}, ${session.inGameDate}\n` +
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
