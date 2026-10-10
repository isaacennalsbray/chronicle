import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { EmailPrompt } from "./email-preference/email-prompt";
import { logout } from "./login/actions";
import "./globals.css";

const sans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const serif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Falnorian Chronicles", template: "%s · Falnorian Chronicles" },
  description: "Player-written chronicles from Falnorian Games leagues.",
};

// Every page reads the session or the database, so render at request time.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-sm">
            <Link href="/" className="text-lg font-semibold">
              Falnorian Chronicles
            </Link>
            {/* One group, so the email always stays after the buttons even when the header wraps. */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              {user && <Link href="/submit" className="link">Submit</Link>}
              {user && <Link href="/me" className="link">My chronicles</Link>}
              {user && <Link href="/profile" className="link">Profile</Link>}
              {user?.isAdmin && <Link href="/admin" className="link">Admin</Link>}
              {user ? (
                <>
                  <form action={logout}>
                    <button className="link">Log out</button>
                  </form>
                  <span className="text-muted" title="Logged in as">{user.email}</span>
                </>
              ) : (
                <Link href="/login" className="link">Log in</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
        {user && user.emailNotifications === null && <EmailPrompt isAdmin={user.isAdmin} />}
        <footer className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-4 text-right text-xs">
            <Link href="/admin" className="text-muted hover:underline">Admin</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
