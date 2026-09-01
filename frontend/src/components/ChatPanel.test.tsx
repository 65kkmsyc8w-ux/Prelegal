import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "@/components/ChatPanel";
import { ApiError, type ChatEntry } from "@/lib/api";
import { emptyNda, type NdaDetails } from "@/lib/nda";

const { getGreeting, sendChatMessage } = vi.hoisted(() => ({
  getGreeting: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getGreeting,
  sendChatMessage,
}));

/** ChatPanel is controlled, so the test holds the state its parent would. */
const Harness = () => {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [details, setDetails] = useState(emptyNda);
  return (
    <>
      <ChatPanel
        history={history}
        details={details}
        onExchange={(entries, fields) => {
          setHistory(entries);
          setDetails(fields);
        }}
      />
      <p>Governing law: {details.governingLaw}</p>
    </>
  );
};

const withGoverningLaw = (law: string): NdaDetails => ({
  ...emptyNda(),
  governingLaw: law,
});

beforeEach(() => {
  vi.clearAllMocks();
  getGreeting.mockResolvedValue({ reply: "What is this agreement for?" });
});

const say = async (message: string) => {
  await userEvent.type(screen.getByLabelText("Your message"), message);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("ChatPanel", () => {
  it("opens the conversation with the assistant's greeting", async () => {
    render(<Harness />);

    expect(await screen.findByText("What is this agreement for?")).toBeInTheDocument();
  });

  it("shows what the user said and what came back", async () => {
    sendChatMessage.mockResolvedValue({
      reply: "Which state's law?",
      fields: emptyNda(),
    });
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Evaluating a supply deal");

    expect(screen.getByText("Evaluating a supply deal")).toBeInTheDocument();
    expect(screen.getByText("Which state's law?")).toBeInTheDocument();
  });

  it("carries the fields the assistant gathered up to the page", async () => {
    sendChatMessage.mockResolvedValue({
      reply: "Noted.",
      fields: withGoverningLaw("Delaware"),
    });
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Delaware law");

    expect(screen.getByText("Governing law: Delaware")).toBeInTheDocument();
  });

  it("sends the conversation so far, so the assistant has the thread", async () => {
    sendChatMessage.mockResolvedValue({ reply: "Noted.", fields: emptyNda() });
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Delaware law");

    const [message, history] = sendChatMessage.mock.calls[0];
    expect(message).toBe("Delaware law");
    expect(history).toEqual([
      { role: "assistant", content: "What is this agreement for?" },
    ]);
  });

  it("empties the box once the message has been sent", async () => {
    sendChatMessage.mockResolvedValue({ reply: "Noted.", fields: emptyNda() });
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Delaware law");

    expect(screen.getByLabelText("Your message")).toHaveValue("");
  });

  it("keeps what was typed when the message did not get through", async () => {
    sendChatMessage.mockRejectedValue(new ApiError(502, "The AI answered with nothing"));
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Delaware law");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI answered with nothing",
    );
    expect(screen.getByLabelText("Your message")).toHaveValue("Delaware law");
  });

  it("says so when the server cannot be reached at all", async () => {
    sendChatMessage.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Delaware law");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });

  it("leaves the cursor in the box, ready for the next answer", async () => {
    sendChatMessage.mockResolvedValue({ reply: "Noted.", fields: emptyNda() });
    render(<Harness />);
    await screen.findByText("What is this agreement for?");

    await say("Delaware law");

    await waitFor(() =>
      expect(screen.getByLabelText("Your message")).toHaveFocus(),
    );
  });

  it("says so when even the greeting cannot be fetched", async () => {
    getGreeting.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Harness />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });
});
