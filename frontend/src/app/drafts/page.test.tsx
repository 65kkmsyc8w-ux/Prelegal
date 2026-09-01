import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Drafts } from "@/app/drafts/page";

const { listDrafts } = vi.hoisted(() => ({ listDrafts: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listDrafts,
}));

const card = {
  id: 7,
  document: "mutual-nda",
  title: "Mutual Non-Disclosure Agreement",
  updatedAt: "2026-09-01T10:00:00",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the library", () => {
  it("names every agreement that has been started", async () => {
    listDrafts.mockResolvedValue([
      card,
      { ...card, id: 8, title: "Pilot Agreement" },
    ]);
    render(<Drafts />);

    expect(
      await screen.findByRole("link", { name: "Mutual Non-Disclosure Agreement" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pilot Agreement" })).toBeInTheDocument();
  });

  it("opens a draft where its conversation left off", async () => {
    listDrafts.mockResolvedValue([card]);
    render(<Drafts />);

    expect(
      await screen.findByRole("link", { name: card.title }),
    ).toHaveAttribute("href", "/?draft=7");
  });

  it("says when each was last worked on, as a date", async () => {
    listDrafts.mockResolvedValue([card]);
    render(<Drafts />);

    expect(
      await screen.findByText("Last worked on 1 September 2026"),
    ).toBeInTheDocument();
  });

  it("offers somewhere to start when there is nothing to look back at", async () => {
    listDrafts.mockResolvedValue([]);
    render(<Drafts />);

    expect(
      await screen.findByText("You have not started an agreement yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start one" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("says so when the library cannot be fetched", async () => {
    listDrafts.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<Drafts />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });
});
