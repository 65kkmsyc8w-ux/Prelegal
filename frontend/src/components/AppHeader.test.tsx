import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/AppHeader";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/" } }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

const ada = { id: 1, email: "ada@example.com", display_name: "Ada" };

beforeEach(() => {
  pathname.value = "/";
});

const nav = () =>
  within(screen.getByRole("navigation", { name: "Primary" }));

describe("the platform header", () => {
  it("names who is signed in", () => {
    render(<AppHeader user={ada} onSignOut={vi.fn()} />);

    expect(screen.getByText("Signed in as Ada")).toBeInTheDocument();
  });

// next/link normalises the trailing slash away outside a built export, where
// trailingSlash puts it back. Both forms resolve: the backend answers a visit
// to /drafts with a redirect to /drafts/. What matters is which screen it is.
  it("offers the way to a new document and to the library", () => {
    render(<AppHeader user={ada} onSignOut={vi.fn()} />);

    expect(nav().getByRole("link", { name: "New document" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(nav().getByRole("link", { name: "My drafts" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/drafts\/?$/),
    );
  });

  it("marks the screen the reader is on", () => {
    pathname.value = "/drafts/";
    render(<AppHeader user={ada} onSignOut={vi.fn()} />);

    expect(nav().getByRole("link", { name: "My drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(nav().getByRole("link", { name: "New document" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks it whether or not the path carries a trailing slash", () => {
    // The export writes directories, and the path can be read either way.
    pathname.value = "/drafts";
    render(<AppHeader user={ada} onSignOut={vi.fn()} />);

    expect(nav().getByRole("link", { name: "My drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
