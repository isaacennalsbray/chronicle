import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listChroniclesByAuthor, seasonTitle, sessionLabel } from "@/lib/queries";
import { chroniclePath } from "@/lib/slug";
import { DismissButton } from "./dismiss-button";

export const metadata: Metadata = { title: "My chronicles" };

export default async function MyChroniclesPage() {
  const user = await requireUser();
  const rows = await listChroniclesByAuthor(user.id);

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold">My chronicles</h1>
      <p className="mt-1 text-sm text-muted">Logged in as {user.email}</p>
      {rows.length === 0 ? (
        <p className="mt-6">
          You haven&apos;t submitted any chronicles yet. <Link href="/submit" className="link">Submit one</Link>
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-border">
          {rows.map(({ chronicle, session, season, league }) => (
            <li key={chronicle.id} className="flex items-baseline justify-between gap-4 py-3">
              <div>
                <Link href={chroniclePath(chronicle)} className="link font-medium">{chronicle.title}</Link>
                <p className="text-sm text-muted">
                  {seasonTitle(season, league)} · {sessionLabel(session)}
                </p>
                {chronicle.status === "rejected" && chronicle.rejectionReason && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-rejected-fg">Reason: {chronicle.rejectionReason}</p>
                )}
              </div>
              <div className="flex shrink-0 items-baseline gap-3">
                <StatusBadge status={chronicle.status} />
                {chronicle.status === "rejected" && <DismissButton id={chronicle.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "pending") {
    return <span className="shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning-fg">Pending review</span>;
  }
  if (status === "rejected") {
    return <span className="shrink-0 rounded-full bg-rejected-bg px-2 py-0.5 text-xs text-rejected-fg">Rejected</span>;
  }
  return <span className="shrink-0 text-xs text-muted">Published</span>;
}
