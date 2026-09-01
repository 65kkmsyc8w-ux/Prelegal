import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SignUpPage from "@/app/signup/page";
import { ApiError } from "@/lib/api";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  signUp,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const register = async () => {
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Your name"), "Ada");
  await userEvent.type(screen.getByLabelText("Password"), "opensesame");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
};

describe("the sign up screen", () => {
  it("asks for an email, a name and a password", () => {
    render(<SignUpPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("says how long a password has to be before one is refused", () => {
    render(<SignUpPage />);

    expect(screen.getByText("At least eight characters.")).toBeInTheDocument();
  });

  it("offers a way back for someone who already has an account", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/login\/?$/),
    );
  });

  it("registers and goes straight into the platform, with no second step", async () => {
    signUp.mockResolvedValue({ id: 1, email: "ada@example.com", display_name: "Ada" });
    render(<SignUpPage />);

    await register();

    expect(signUp).toHaveBeenCalledWith("ada@example.com", "Ada", "opensesame");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("says so when the email is already registered", async () => {
    signUp.mockRejectedValue(new ApiError(409, "An account already uses that email"));
    render(<SignUpPage />);

    await register();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account already uses that email",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers the button again after a failure", async () => {
    signUp.mockRejectedValue(new ApiError(409, "An account already uses that email"));
    render(<SignUpPage />);

    await register();

    expect(await screen.findByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("says so when the server cannot be reached at all", async () => {
    signUp.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SignUpPage />);

    await register();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });
});
