import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Home } from "@/app/page";

const setup = () => {
  render(<Home />);
  return {
    user: userEvent.setup(),
    document: () => screen.getByRole("article").textContent ?? "",
  };
};

describe("the page", () => {
  it("shows the form and the agreement together", () => {
    setup();
    expect(screen.getByRole("group", { name: "The agreement" })).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("writes what the user types into the agreement", async () => {
    const { user, document } = setup();
    expect(document()).toContain("[Governing Law]");

    await user.type(screen.getByLabelText("Governing law"), "Delaware");

    expect(document()).toContain("the laws of the State of Delaware");
    expect(document()).not.toContain("[Governing Law]");
  });

  it("carries a party's company into the signature table", async () => {
    const { user } = setup();
    const party = within(screen.getByRole("group", { name: "Party 1" }));
    await user.type(party.getByLabelText("Company"), "Acme Inc");

    expect(screen.getByRole("columnheader", { name: "Acme Inc" })).toBeInTheDocument();
  });

  it("rewrites the term when the user changes how long the MNDA lasts", async () => {
    const { user, document } = setup();
    expect(document()).toContain("Expires 1 year from the Effective Date.");

    await user.click(
      within(screen.getByRole("group", { name: "MNDA term" })).getByRole("radio", {
        name: "Continues until terminated",
      }),
    );

    expect(document()).toContain("Continues until terminated");
    expect(document()).not.toContain("Expires 1 year");
  });

  it("prints when the user asks to download", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(print).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
