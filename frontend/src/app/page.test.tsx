import { readFileSync } from "node:fs";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Home } from "@/app/page";
import { ApiError } from "@/lib/api";
import type { DocumentSpec } from "@/lib/documents";

const { getGreeting, sendChatMessage, getDraft } = vi.hoisted(() => ({
  getGreeting: vi.fn(),
  sendChatMessage: vi.fn(),
  getDraft: vi.fn(),
}));

// The address is what says which draft is open, so the test drives it.
const { nav } = vi.hoisted(() => ({
  nav: { replace: vi.fn(), params: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.params,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getGreeting,
  sendChatMessage,
  getDraft,
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
  draftId: 7,
});

beforeEach(() => {
  vi.clearAllMocks();
  nav.params = new URLSearchParams();
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
      draftId: null,
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

  it("says so when even the greeting cannot be fetched", async () => {
    getGreeting.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Home />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });

  it("offers nothing to download before there is an agreement", async () => {
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    expect(
      screen.queryByRole("button", { name: "Download PDF" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the draft reachable by writing its id into the address", async () => {
    sendChatMessage.mockResolvedValue(drafting());
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("I need an NDA");

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/?draft=7"));
  });

  it("saves nothing while the assistant is still working out what is wanted", async () => {
    sendChatMessage.mockResolvedValue({
      reply: "Which of these did you mean?",
      document: null,
      documentSpec: null,
      fields: {},
      draftId: null,
    });
    render(<Home />);
    await screen.findByText("What kind of agreement do you need?");

    await say("Something legal");

    expect(nav.replace).not.toHaveBeenCalled();
  });
});

const saved = {
  id: 7,
  document: NDA.slug,
  title: NDA.title,
  updatedAt: "2026-09-01T10:00:00",
  documentSpec: NDA,
  fields: { governingLaw: "Delaware" },
  transcript: [
    { role: "user" as const, content: "An NDA please" },
    { role: "assistant" as const, content: "Which state's law?" },
  ],
};

describe("reopening a saved draft", () => {
  it("brings back the conversation and the agreement", async () => {
    nav.params = new URLSearchParams("draft=7");
    getDraft.mockResolvedValue(saved);
    render(<Home />);

    expect(await screen.findByText("Which state's law?")).toBeInTheDocument();
    expect(screen.getByText("An NDA please")).toBeInTheDocument();
    expect(agreement()).toContain("the laws of the State of Delaware");
    expect(getDraft).toHaveBeenCalledWith(7);
  });

  it("does not greet again over a conversation already under way", async () => {
    nav.params = new URLSearchParams("draft=7");
    getDraft.mockResolvedValue(saved);
    render(<Home />);
    await screen.findByText("Which state's law?");

    expect(getGreeting).not.toHaveBeenCalled();
  });

  it("says so when the draft cannot be opened", async () => {
    nav.params = new URLSearchParams("draft=7");
    getDraft.mockRejectedValue(new ApiError(404, "No such draft"));
    render(<Home />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That draft could not be opened",
    );
  });

  it("starts over when the draft is dropped from the address", async () => {
    nav.params = new URLSearchParams("draft=7");
    getDraft.mockResolvedValue(saved);
    const { rerender } = render(<Home />);
    await screen.findByText("Which state's law?");

    // What choosing New document does while a draft is open.
    nav.params = new URLSearchParams();
    rerender(<Home />);

    expect(
      await screen.findByText("What kind of agreement do you need?"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Which state's law?")).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});
