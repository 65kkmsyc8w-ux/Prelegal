"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  ApiError,
  getGreeting,
  sendChatMessage,
  type ChatEntry,
} from "@/lib/api";
import type { NdaDetails } from "@/lib/nda";

interface ChatPanelProps {
  history: ChatEntry[];
  details: NdaDetails;
  onExchange: (history: ChatEntry[], details: NdaDetails) => void;
}

const failureText = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "Could not reach the server. Try again.";

export const ChatPanel = ({ history, details, onExchange }: ChatPanelProps) => {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) {
      return;
    }
    opened.current = true;
    getGreeting()
      .then(({ reply }) => onExchange([{ role: "assistant", content: reply }], details))
      .catch((cause) => setError(failureText(cause)));
  }, [details, onExchange]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError(null);
    const asked: ChatEntry = { role: "user", content: draft };
    try {
      const answer = await sendChatMessage(draft, history, details);
      onExchange(
        [...history, asked, { role: "assistant", content: answer.reply }],
        answer.fields,
      );
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
