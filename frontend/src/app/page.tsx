"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { AuthGate } from "@/components/AuthGate";
import { ChatPanel, type Drafted } from "@/components/ChatPanel";
import { DocumentView } from "@/components/DocumentView";
import { getDraft, getGreeting, type ChatEntry } from "@/lib/api";

const NOTHING_YET: Drafted = {
  document: null,
  spec: null,
  fields: {},
  draftId: null,
};

export const Home = () => {
  const router = useRouter();
  const resuming = useSearchParams().get("draft");
  const [drafted, setDrafted] = useState<Drafted>(NOTHING_YET);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [failed, setFailed] = useState(false);
  // Which draft the conversation on screen belongs to. The first turn writes
  // its id into the address so a reload comes back to it, and without this that
  // would read as a request to load a draft already in hand. It starts
  // undefined rather than null, because "no draft yet" is a conversation that
  // still has to be opened, and null is what the address says once one is.
  const loaded = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const wanted = resuming === null ? null : Number(resuming);
    if (wanted === loaded.current) {
      return;
    }
    loaded.current = wanted;
    setFailed(false);

    // No draft named: a new conversation, whether this is the first visit or
    // New document was chosen while one was open. What was open is cleared when
    // the opening line lands rather than before it, so the screen changes once
    // rather than emptying and then filling. The greeting is fixed text and
    // costs nothing at the provider, so the wait is a round trip and no more.
    if (wanted === null) {
      getGreeting()
        .then(({ reply }) => {
          setDrafted(NOTHING_YET);
          setHistory([{ role: "assistant", content: reply }]);
        })
        .catch(() => setFailed(true));
      return;
    }

    getDraft(wanted)
      .then((draft) => {
        setHistory(draft.transcript);
        setDrafted({
          document: draft.document,
          spec: draft.documentSpec,
          fields: draft.fields,
          draftId: draft.id,
        });
      })
      .catch(() => setFailed(true));
  }, [resuming]);

  const record = useCallback(
    (entries: ChatEntry[], next: Drafted) => {
      setHistory(entries);
      setDrafted(next);
      if (next.draftId !== null && next.draftId !== loaded.current) {
        loaded.current = next.draftId;
        router.replace(`/?draft=${next.draftId}`);
      }
    },
    [router],
  );

  if (failed) {
    return (
      <main className="page notice">
        <p role="alert">
          {resuming === null
            ? "Could not reach the server. Reload to try again."
            : "That draft could not be opened. It may have been started under another account."}
        </p>
        <Link href="/drafts/">Back to my drafts</Link>
      </main>
    );
  }

  // A draft is being fetched: the conversation must not start until it lands,
  // or the greeting would be written over the thread that is already there.
  if (resuming !== null && drafted.draftId === null) {
    return (
      <main className="page notice">
        <p>Opening your draft</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="masthead">
        <h1>Agreement drafter</h1>
        <p>
          Tell the assistant what you need and the agreement builds as you talk.
          Anything not yet settled shows as a placeholder in square brackets.
        </p>
      </header>

      <div className="columns">
        <div className="column chat-column">
          <ChatPanel history={history} drafted={drafted} onExchange={record} />
        </div>
        <div className="column document-column">
          {drafted.spec ? (
            <>
              <div className="document-toolbar">
                <button
                  type="button"
                  className="download"
                  onClick={() => window.print()}
                >
                  Download PDF
                </button>
                <p className="hint">
                  Opens your browser print dialog. Choose Save as PDF to keep a copy.
                </p>
              </div>
              <DocumentView spec={drafted.spec} fields={drafted.fields} />
            </>
          ) : (
            <p className="waiting-for-document">
              Once we have settled on which agreement you need, it will build
              here as you answer.
            </p>
          )}
        </div>
      </div>
    </main>
  );
};

// useSearchParams reads something only the browser knows, so the export needs a
// boundary to render past while it is unknown.
const Page = () => (
  <AuthGate>
    <Suspense
      fallback={
        <main className="page notice">
          <p>Loading</p>
        </main>
      }
    >
      <Home />
    </Suspense>
  </AuthGate>
);

export default Page;
