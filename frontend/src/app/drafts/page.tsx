"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthGate } from "@/components/AuthGate";
import { listDrafts, type DraftSummary } from "@/lib/api";
import { formatDate } from "@/lib/fields";

export const Drafts = () => {
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    listDrafts()
      .then(setDrafts)
      .catch(() => setUnreachable(true));
  }, []);

  return (
    <main className="page library">
      <header className="masthead">
        <h1>My drafts</h1>
        <p>
          Every agreement you have started. Open one to pick the conversation up
          where you left it.
        </p>
      </header>

      <div className="library-body">
        {unreachable && (
          <p className="notice" role="alert">
            Could not reach the server. Reload to try again.
          </p>
        )}

        {drafts === null && !unreachable && <p className="notice">Loading</p>}

        {drafts !== null && drafts.length === 0 && (
          <div className="library-empty">
            <p>You have not started an agreement yet.</p>
            <Link className="submit" href="/">
              Start one
            </Link>
          </div>
        )}

        {drafts !== null && drafts.length > 0 && (
          <ul className="draft-cards">
            {drafts.map((draft) => (
              <li key={draft.id} className="draft-card">
                <h2>
                  <Link href={`/?draft=${draft.id}`}>{draft.title}</Link>
                </h2>
                {/* The date alone: the hour a draft was last touched is not
                    what anyone is looking for in a library. */}
                <p className="hint">
                  Last worked on {formatDate(draft.updatedAt.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

const Page = () => (
  <AuthGate>
    <Drafts />
  </AuthGate>
);

export default Page;
