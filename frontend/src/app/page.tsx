"use client";

import { useCallback, useState } from "react";

import { AuthGate } from "@/components/AuthGate";
import { ChatPanel } from "@/components/ChatPanel";
import { NdaDocument } from "@/components/NdaDocument";
import type { ChatEntry } from "@/lib/api";
import { emptyNda, type NdaDetails } from "@/lib/nda";

export const Home = () => {
  const [details, setDetails] = useState(emptyNda);
  const [history, setHistory] = useState<ChatEntry[]>([]);

  const record = useCallback((entries: ChatEntry[], fields: NdaDetails) => {
    setHistory(entries);
    setDetails(fields);
  }, []);

  return (
    <main className="page">
      <header className="masthead">
        <h1>Mutual NDA creator</h1>
        <p>
          Tell the assistant what you need and the agreement builds as you talk.
          Anything not yet settled shows as a placeholder in square brackets.
        </p>
      </header>

      <div className="columns">
        <div className="column chat-column">
          <ChatPanel history={history} details={details} onExchange={record} />
        </div>
        <div className="column document-column">
          <div className="document-toolbar">
            <button type="button" className="download" onClick={() => window.print()}>
              Download PDF
            </button>
            <p className="hint">
              Opens your browser print dialog. Choose Save as PDF to keep a copy.
            </p>
          </div>
          <NdaDocument details={details} />
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
