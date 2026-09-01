import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "@/components/AuthGate";
import { ApiError } from "@/lib/api";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { me, signOut } = vi.hoisted(() => ({ me: vi.fn(), signOut: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

// Spread the real module so ApiError stays the class AuthGate checks against.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  me,
  signOut,
}));

const ada = { id: 1, display_name: "Ada" };

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
});
