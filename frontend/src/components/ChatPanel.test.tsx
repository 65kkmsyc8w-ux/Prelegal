import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/ChatPanel";
import { ApiError, type ChatEntry } from "@/lib/api";
import type { Drafted } from "@/components/ChatPanel";

const { sendChatMessage } = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  sendChatMessage,
}));

const GREETING = "What is this agreement for?";

const NOTHING_YET: Drafted = {
  document: null,
  spec: null,
  fields: {},
  draftId: null,
};

/** ChatPanel is controlled, so the test holds the state its parent would,
 * including the opening line the page fetches before the panel is shown. */
const Harness = () => {
  const [history, setHistory] = useState<ChatEntry[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [drafted, setDrafted] = useState<Drafted>(NOTHING_YET);
  return (
    <>
      <ChatPanel
        history={history}
        drafted={drafted}
        onExchange={(entries, next) => {
          setHistory(entries);
          setDrafted(next);
        }}
      />
      <p>Drafting: {drafted.document ?? "nothing yet"}</p>
      <p>Governing law: {String(drafted.fields.governingLaw ?? "")}</p>
      <p>Draft: {drafted.draftId ?? "unsaved"}</p>
    </>
  );
};

/** What the server answers with once a document is being drafted. */
const answered = (fields: Record<string, unknown> = {}) => ({
  reply: "Noted.",
  document: "mutual-nda",
  documentSpec: { slug: "mutual-nda", fields: [] },
  fields,
  draftId: 7,
});

beforeEach(() => {
  vi.clearAllMocks();
});

const say = async (message: string) => {
  await userEvent.type(screen.getByLabelText("Your message"), message);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("ChatPanel", () => {
  it("shows the conversation it was handed", () => {
    render(<Harness />);

    expect(screen.getByText(GREETING)).toBeInTheDocument();
  });

  it("shows what the user said and what came back", async () => {
    sendChatMessage.mockResolvedValue({
      ...answered(),
      reply: "Which state's law?",
    });
    render(<Harness />);

    await say("Evaluating a supply deal");

    expect(screen.getByText("Evaluating a supply deal")).toBeInTheDocument();
    expect(screen.getByText("Which state's law?")).toBeInTheDocument();
  });

  it("carries the document the assistant settled on up to the page", async () => {
    sendChatMessage.mockResolvedValue(answered());
    render(<Harness />);
    expect(screen.getByText("Drafting: nothing yet")).toBeInTheDocument();

    await say("An NDA please");

    expect(screen.getByText("Drafting: mutual-nda")).toBeInTheDocument();
  });

  it("carries the fields the assistant gathered up to the page", async () => {
    sendChatMessage.mockResolvedValue(answered({ governingLaw: "Delaware" }));
    render(<Harness />);

    await say("Delaware law");

    expect(screen.getByText("Governing law: Delaware")).toBeInTheDocument();
  });

  it("sends the conversation so far, so the assistant has the thread", async () => {
    sendChatMessage.mockResolvedValue(answered());
    render(<Harness />);

    await say("Delaware law");

    const [message, history, document] = sendChatMessage.mock.calls[0];
    expect(message).toBe("Delaware law");
    expect(history).toEqual([{ role: "assistant", content: GREETING }]);
    // Nothing is settled on yet, so the assistant is still at the front desk.
    expect(document).toBeNull();
  });

  it("empties the box once the message has been sent", async () => {
    sendChatMessage.mockResolvedValue(answered());
    render(<Harness />);

    await say("Delaware law");

    expect(screen.getByLabelText("Your message")).toHaveValue("");
  });

  it("keeps what was typed when the message did not get through", async () => {
    sendChatMessage.mockRejectedValue(new ApiError(502, "The AI answered with nothing"));
    render(<Harness />);

    await say("Delaware law");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI answered with nothing",
    );
    expect(screen.getByLabelText("Your message")).toHaveValue("Delaware law");
  });

  it("says so when the server cannot be reached at all", async () => {
    sendChatMessage.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Harness />);

    await say("Delaware law");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });

  it("leaves the cursor in the box, ready for the next answer", async () => {
    sendChatMessage.mockResolvedValue(answered());
    render(<Harness />);

    await say("Delaware law");

    await waitFor(() =>
      expect(screen.getByLabelText("Your message")).toHaveFocus(),
    );
  });

  it("says it is waiting, because the assistant takes a long time", async () => {
    let answer: (value: unknown) => void = () => {};
    sendChatMessage.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    render(<Harness />);

    await say("Delaware law");

    expect(screen.getByRole("status")).toHaveTextContent("Waiting for a reply");

    answer(answered());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("announces what the assistant says as it arrives", () => {
    render(<Harness />);

    expect(screen.getByRole("list")).toHaveAttribute("aria-live", "polite");
  });

  it("carries the draft the turn was saved into up to the page", async () => {
    sendChatMessage.mockResolvedValue(answered());
    render(<Harness />);

    await say("An NDA please");

    expect(screen.getByText("Draft: 7")).toBeInTheDocument();
  });

  it("sends the draft it is writing to, so later turns join it", async () => {
    sendChatMessage.mockResolvedValue(answered());
    render(<Harness />);
    await say("An NDA please");

    await say("Delaware law");

    expect(sendChatMessage.mock.calls[1][4]).toBe(7);
  });
});
