import "server-only";
import { Resend } from "resend";

type Email = { to: string | string[]; subject: string; text: string };

export async function sendEmail({ to, subject, text }: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    // Local development without an email provider: print the message instead.
    console.info(`\n--- email (dev, not sent) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`);
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text });
  if (error) throw new Error(`Failed to send email: ${error.message}`);
}
