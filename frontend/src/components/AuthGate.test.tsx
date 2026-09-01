import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "@/components/AuthGate";
import { ApiError } from "@/lib/api";
import { DISCLAIMER } from "@/lib/disclaimer";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { me, signOut } = vi.hoisted(() => ({ me: vi.fn(), signOut: vi.fn() }));

// AppHeader marks the screen you are on, so the gate needs a path too.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/",
}));

// Spread the real module so ApiError stays the class AuthGate checks against.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  me,
  signOut,
}));

const ada = { id: 1, email: "ada@example.com", display_name: "Ada" };

beforeEach(() => {
  vi.clearAllMocks();
});

const renderGate = () =>
  render(
    <AuthGate>
      <p>The platform</p>
    </AuthGate>,
  );

describe("AuthGate", () => {
  it("waits before showing anything of the platform", () => {
    me.mockReturnValue(new Promise(() => {}));
    renderGate();

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.queryByText("The platform")).not.toBeInTheDocument();
  });

  it("opens the platform to a signed in user", async () => {
    me.mockResolvedValue(ada);
    renderGate();

    expect(await screen.findByText("The platform")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("names who is signed in", async () => {
    me.mockResolvedValue(ada);
    renderGate();

    expect(await screen.findByText("Signed in as Ada")).toBeInTheDocument();
  });

  it("sends a caller who has not signed in to the login screen", async () => {
    me.mockRejectedValue(new ApiError(401, "Not signed in"));
    renderGate();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
    expect(screen.queryByText("The platform")).not.toBeInTheDocument();
  });

  it("says so rather than bouncing to a login it also cannot reach", async () => {
    me.mockRejectedValue(new TypeError("Failed to fetch"));
    renderGate();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("ends the session and returns to the login screen on sign out", async () => {
    me.mockResolvedValue(ada);
    signOut.mockResolvedValue(undefined);
    renderGate();

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login/"));
  });

  it("puts the platform's own navigation around what it lets through", async () => {
    me.mockResolvedValue(ada);
    renderGate();

    const nav = within(await screen.findByRole("navigation", { name: "Primary" }));
    expect(nav.getByRole("link", { name: "New document" })).toBeInTheDocument();
    expect(nav.getByRole("link", { name: "My drafts" })).toBeInTheDocument();
  });

  it("warns that what is drafted here is a draft", async () => {
    me.mockResolvedValue(ada);
    renderGate();

    expect(await screen.findByRole("note")).toHaveTextContent(DISCLAIMER);
  });

  it("shows none of the chrome to someone still being checked", () => {
    me.mockReturnValue(new Promise(() => {}));
    renderGate();

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
