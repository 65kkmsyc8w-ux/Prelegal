import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Home } from "@/app/page";
import type { DocumentSpec } from "@/lib/documents";

const { getGreeting, sendChatMessage } = vi.hoisted(() => ({
  getGreeting: vi.fn(),
  sendChatMessage: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getGreeting,
  sendChatMessage,
}));

const spec = (slug: string): DocumentSpec =>
  JSON.parse(readFileSync(`../documents/${slug}.spec.json`, "utf8"));

const NDA = spec("mutual-nda");

const agreement = () => screen.getByRole("article").textContent ?? "";

/** What the server answers with once an agreement is being drafted. */
const drafting = (
  fields: Record<string, unknown> = {},
  declared: DocumentSpec = NDA,
) => ({
  reply: "Noted.",
  document: declared.slug,
  documentSpec: declared,
  fields,
});

beforeEach(() => {
  vi.clearAllMocks();
  getGreeting.mockResolvedValue({ reply: "What kind of agreement do you need?" });
});

const say = async (message: string) => {
  await userEvent.type(screen.getByLabelText("Your message"), message);
  await userEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("the page", () => {
  it("opens on the conversation, with no agreement chosen yet", async () => {
    render(<Home />);

    expect(
      await screen.findByText("What kind of agreement do you need?"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByText(/settled on which agreement/)).toBeInTheDocument();
  });

  it("builds the agreement once the assistant settles on one", async () => {
    sendChatMessage.mockResolvedValue(drafting());
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("I need an NDA");

    expect(
      screen.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" }),
    ).toBeInTheDocument();
  });

  it("builds whichever agreement was chosen, not just the NDA", async () => {
    sendChatMessage.mockResolvedValue(drafting({}, spec("pilot-agreement")));
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("We want a customer to trial the product");

    expect(
      screen.getByRole("heading", { level: 1, name: "Pilot Agreement" }),
    ).toBeInTheDocument();
  });

  it("writes what the assistant gathered into the agreement", async () => {
    sendChatMessage.mockResolvedValue(drafting({ governingLaw: "Delaware" }));
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("Delaware law");

    expect(agreement()).toContain("the laws of the State of Delaware");
    expect(agreement()).not.toContain("[Governing Law]");
  });

  it("carries a party's company into the signature table", async () => {
    sendChatMessage.mockResolvedValue(
      drafting({ partyOne: { company: "Acme Inc", name: "", title: "", noticeAddress: "" } }),
    );
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("We are Acme Inc");

    expect(screen.getByRole("columnheader", { name: "Acme Inc" })).toBeInTheDocument();
  });

  it("rewrites the term when the assistant settles how long the MNDA lasts", async () => {
    sendChatMessage.mockResolvedValue(
      drafting({ term: { mode: "untilTerminated", years: 1 } }),
    );
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("It should run until we terminate it");

    expect(agreement()).toContain("Continues until terminated");
    expect(agreement()).not.toContain("Expires 1 year");
  });

  it("keeps the conversation going when the assistant cannot draft what was asked", async () => {
    sendChatMessage.mockResolvedValue({
      reply: "We cannot draft an employment contract. The closest is our Professional Services Agreement.",
      document: null,
      documentSpec: null,
      fields: {},
    });
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("I need an employment contract");

    expect(screen.getByText(/cannot draft an employment contract/)).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("prints when the user asks to download", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    sendChatMessage.mockResolvedValue(drafting());
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");
    await say("I need an NDA");

    await userEvent.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("offers nothing to download before there is an agreement", async () => {
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    expect(
      screen.queryByRole("button", { name: "Download PDF" }),
    ).not.toBeInTheDocument();
  });
});
