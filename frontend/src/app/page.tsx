"use client";

import { useCallback, useState } from "react";

import { AuthGate } from "@/components/AuthGate";
import { ChatPanel, type Drafted } from "@/components/ChatPanel";
import { DocumentView } from "@/components/DocumentView";
import type { ChatEntry } from "@/lib/api";

const NOTHING_YET: Drafted = { document: null, spec: null, fields: {} };

export const Home = () => {
  const [drafted, setDrafted] = useState<Drafted>(NOTHING_YET);
  const [history, setHistory] = useState<ChatEntry[]>([]);

  const record = useCallback((entries: ChatEntry[], next: Drafted) => {
    setHistory(entries);
    setDrafted(next);
  }, []);

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

const Page = () => (
  <AuthGate>
    <Home />
  </AuthGate>
);

export default Page;
