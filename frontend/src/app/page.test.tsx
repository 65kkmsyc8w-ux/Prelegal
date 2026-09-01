import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Home } from "@/app/page";
import { emptyNda } from "@/lib/nda";

const { getGreeting, sendChatMessage } = vi.hoisted(() => ({
  getGreeting: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getGreeting,
  sendChatMessage,
}));

const agreement = () => screen.getByRole("article").textContent ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  getGreeting.mockResolvedValue({ reply: "What is this agreement for?" });
});

const say = async (message: string) => {
  await userEvent.type(screen.getByLabelText("Your message"), message);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("the page", () => {
  it("shows the conversation and the agreement together", async () => {
    render(<Home />);

    expect(await screen.findByText("What is this agreement for?")).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("writes what the assistant gathered into the agreement", async () => {
    sendChatMessage.mockResolvedValue({
      reply: "Noted.",
      fields: { ...emptyNda(), governingLaw: "Delaware" },
    });
    render(<Home />);
    await screen.findByText("What is this agreement for?");
    expect(agreement()).toContain("[Governing Law]");

    await say("Delaware law");

    expect(agreement()).toContain("the laws of the State of Delaware");
    expect(agreement()).not.toContain("[Governing Law]");
  });

  it("carries a party's company into the signature table", async () => {
    const fields = emptyNda();
    fields.partyOne.company = "Acme Inc";
    sendChatMessage.mockResolvedValue({ reply: "Noted.", fields });
    render(<Home />);
    await screen.findByText("What is this agreement for?");

    await say("We are Acme Inc");

    expect(screen.getByRole("columnheader", { name: "Acme Inc" })).toBeInTheDocument();
  });

  it("rewrites the term when the assistant settles how long the MNDA lasts", async () => {
    sendChatMessage.mockResolvedValue({
      reply: "Noted.",
      fields: { ...emptyNda(), termKind: "untilTerminated" as const },
    });
    render(<Home />);
    await screen.findByText("What is this agreement for?");
    expect(agreement()).toContain("Expires 1 year from the Effective Date.");

    await say("It should run until we terminate it");

    expect(agreement()).toContain("Continues until terminated");
    expect(agreement()).not.toContain("Expires 1 year");
  });

  it("prints when the user asks to download", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<Home />);
    await screen.findByText("What is this agreement for?");

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
