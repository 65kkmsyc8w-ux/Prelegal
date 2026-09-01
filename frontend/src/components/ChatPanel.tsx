"use client";

import { useRef, useState, type FormEvent } from "react";

import { failureText, sendChatMessage, type ChatEntry } from "@/lib/api";
import type { DocumentSpec, Fields } from "@/lib/documents";

export interface Drafted {
  document: string | null;
  spec: DocumentSpec | null;
  fields: Fields;
  /** The saved draft this conversation writes to, once an agreement has been
   * settled on. The server mints it; this side only carries it back. */
  draftId: number | null;
}

interface ChatPanelProps {
  history: ChatEntry[];
  drafted: Drafted;
  onExchange: (history: ChatEntry[], drafted: Drafted) => void;
}

/**
 * The conversation, fully controlled. Which conversation is on screen, and how
 * one begins, belong to the page: it is the page that knows whether this is a
 * new draft or one being picked back up.
 */
export const ChatPanel = ({ history, drafted, onExchange }: ChatPanelProps) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    const asked: ChatEntry = { role: "user", content: draft };
    try {
      const answer = await sendChatMessage(
        draft,
        history,
        drafted.document,
        drafted.fields,
        drafted.draftId,
      );
      onExchange([...history, asked, { role: "assistant", content: answer.reply }], {
        document: answer.document,
        spec: answer.documentSpec,
        fields: answer.fields,
        draftId: answer.draftId,
      });
      setDraft("");
    } catch (cause) {
      // The draft is left in the box: the message never reached the assistant,
      // so retyping it would be the only way to try again.
      setError(failureText(cause));
    }
    setSending(false);
    input.current?.focus();
  };

  return (
    <section className="chat" aria-label="Chat">
      <ol className="transcript" aria-live="polite">
        {history.map((entry, index) => (
          <li key={index} className={entry.role}>
            <span className="who">{entry.role === "user" ? "You" : "Assistant"}</span>
            <span className="said">{entry.content}</span>
          </li>
        ))}
      </ol>

      {sending && (
        <p className="waiting" role="status">
          Waiting for a reply. The assistant can take a couple of minutes
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form className="chat-form" onSubmit={send}>
        <label htmlFor="message">Your message</label>
        <input
          id="message"
          ref={input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tell the assistant about your agreement"
          autoComplete="off"
          required
        />
        <button type="submit" className="send" disabled={sending}>
          {sending ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
};
