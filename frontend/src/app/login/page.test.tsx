import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";
import { ApiError } from "@/lib/api";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  signIn,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const signInAs = async (email: string, password: string) => {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

describe("the login screen", () => {
  it("asks for an email and a password", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("never shows the password back", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("offers a way to register for someone with no account", () => {
    render(<LoginPage />);

    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      // next/link drops the trailing slash outside a built export; both forms
      // resolve, since a visit to /signup redirects to /signup/.
      expect.stringMatching(/^\/signup\/?$/),
    );
  });

  it("signs in and enters the platform", async () => {
    signIn.mockResolvedValue({ id: 1, email: "ada@example.com", display_name: "Ada" });
    render(<LoginPage />);

    await signInAs("ada@example.com", "opensesame");

    expect(signIn).toHaveBeenCalledWith("ada@example.com", "opensesame");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("stays put and says why when the credentials are refused", async () => {
    signIn.mockRejectedValue(
      new ApiError(401, "That email and password do not match"),
    );
    render(<LoginPage />);

    await signInAs("ada@example.com", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password do not match",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers the button again after a failure", async () => {
    signIn.mockRejectedValue(new ApiError(401, "That email and password do not match"));
    render(<LoginPage />);

    await signInAs("ada@example.com", "wrong");

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("says so when the server cannot be reached at all", async () => {
    signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);

    await signInAs("ada@example.com", "opensesame");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server",
    );
  });
});
