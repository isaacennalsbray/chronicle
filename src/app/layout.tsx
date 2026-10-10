import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
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
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-4 text-sm">
            <Link href="/" className="mr-auto text-lg font-semibold">
              Falnorian Chronicles
            </Link>
            {user && <Link href="/submit" className="link">Submit</Link>}
            {user && <Link href="/me" className="link">My chronicles</Link>}
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
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-4 text-right text-xs">
            <Link href="/admin" className="text-muted hover:underline">Admin</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
