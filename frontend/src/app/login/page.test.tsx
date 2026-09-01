import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { ApiError } from "@/lib/api";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { createSession } = vi.hoisted(() => ({ createSession: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createSession,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const signIn = async (name: string) => {
  await userEvent.type(screen.getByLabelText("Your name"), name);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("the login screen", () => {
  it("asks for a name and nothing else", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("opens a session under the name given and enters the platform", async () => {
    createSession.mockResolvedValue({ id: 1, display_name: "Ada" });
    render(<LoginPage />);

    await signIn("Ada");

    expect(createSession).toHaveBeenCalledWith("Ada");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("stays put and says why when the backend refuses the name", async () => {
    createSession.mockRejectedValue(new ApiError(422, "Name is required"));
    render(<LoginPage />);

    await signIn("Ada");

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required");
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers the button again after a failure", async () => {
    createSession.mockRejectedValue(new ApiError(422, "Name is required"));
    render(<LoginPage />);

    await signIn("Ada");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("says so when the server cannot be reached at all", async () => {
    createSession.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);

    await signIn("Ada");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });
});
