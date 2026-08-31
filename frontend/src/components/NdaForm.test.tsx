import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { NdaForm } from "@/components/NdaForm";
import { emptyNda, type NdaDetails } from "@/lib/nda";

/**
 * The form is controlled, so the tests drive it through a stateful host the way
 * the page does. `latest` exposes what the form has produced so far.
 */
const renderForm = (onDownload = vi.fn()) => {
  const state: { details: NdaDetails } = { details: emptyNda() };

  const Host = () => {
    const [details, setDetails] = useState(emptyNda);
    state.details = details;
    return (
      <NdaForm details={details} onChange={setDetails} onDownload={onDownload} />
    );
  };

  render(<Host />);
  return {
    user: userEvent.setup(),
    latest: () => state.details,
    party: (legend: string) => within(screen.getByRole("group", { name: legend })),
  };
};

describe("NdaForm", () => {
  it("groups the fields under headed sections", () => {
    renderForm();
    for (const legend of [
      "The agreement",
      "MNDA term",
      "Term of confidentiality",
      "Governing law",
      "Party 1",
      "Party 2",
      "Modifications",
    ]) {
      expect(screen.getByRole("group", { name: legend })).toBeInTheDocument();
    }
  });

  it("reports what the user types into a text field", async () => {
    const { user, latest } = renderForm();
    await user.type(screen.getByLabelText("Governing law"), "Delaware");
    expect(latest().governingLaw).toBe("Delaware");
  });

  it("reports the purpose", async () => {
    const { user, latest } = renderForm();
    await user.type(screen.getByLabelText("Purpose"), "Evaluating a deal.");
    expect(latest().purpose).toBe("Evaluating a deal.");
  });

  it("reports the effective date", async () => {
    const { user, latest } = renderForm();
    await user.type(screen.getByLabelText("Effective date"), "2026-08-31");
    expect(latest().effectiveDate).toBe("2026-08-31");
  });

  it("starts on a fixed term and offers the number of years", () => {
    renderForm();
    const group = within(screen.getByRole("group", { name: "MNDA term" }));
    expect(
      group.getByRole("radio", {
        name: "Expires a set number of years from the effective date",
      }),
    ).toBeChecked();
    expect(group.getByLabelText("Years")).toHaveValue(1);
  });

  it("drops the number of years once the term runs until termination", async () => {
    const { user, latest } = renderForm();
    const group = within(screen.getByRole("group", { name: "MNDA term" }));
    await user.click(group.getByRole("radio", { name: "Continues until terminated" }));

    expect(latest().termKind).toBe("untilTerminated");
    expect(group.queryByLabelText("Years")).not.toBeInTheDocument();
  });

  it("drops the number of years once confidentiality is perpetual", async () => {
    const { user, latest } = renderForm();
    const group = within(
      screen.getByRole("group", { name: "Term of confidentiality" }),
    );
    await user.click(group.getByRole("radio", { name: "In perpetuity" }));

    expect(latest().confidentialityKind).toBe("perpetual");
    expect(group.queryByLabelText("Years")).not.toBeInTheDocument();
  });

  it("keeps the two year fields apart", async () => {
    const { user, latest } = renderForm();
    const term = within(screen.getByRole("group", { name: "MNDA term" }));
    const confidentiality = within(
      screen.getByRole("group", { name: "Term of confidentiality" }),
    );

    await user.clear(term.getByLabelText("Years"));
    await user.type(term.getByLabelText("Years"), "2");
    await user.clear(confidentiality.getByLabelText("Years"));
    await user.type(confidentiality.getByLabelText("Years"), "7");

    expect(latest().termYears).toBe(2);
    expect(latest().confidentialityYears).toBe(7);
  });

  it("keeps the two parties apart", async () => {
    const { user, latest, party } = renderForm();
    await user.type(party("Party 1").getByLabelText("Company"), "Acme Inc");
    await user.type(party("Party 2").getByLabelText("Company"), "Beta Ltd");

    expect(latest().partyOne.company).toBe("Acme Inc");
    expect(latest().partyTwo.company).toBe("Beta Ltd");
  });

  it("collects every detail of a party", async () => {
    const { user, latest, party } = renderForm();
    const fields = party("Party 1");
    await user.type(fields.getByLabelText("Print name"), "Ada Lovelace");
    await user.type(fields.getByLabelText("Title"), "CEO");
    await user.type(fields.getByLabelText("Notice address"), "ada@acme.example");

    expect(latest().partyOne).toEqual({
      company: "",
      name: "Ada Lovelace",
      title: "CEO",
      noticeAddress: "ada@acme.example",
    });
  });

  it("leaves the other party untouched when one is edited", async () => {
    const { user, latest, party } = renderForm();
    await user.type(party("Party 1").getByLabelText("Print name"), "Ada");
    expect(latest().partyTwo).toEqual(emptyNda().partyTwo);
  });

  it("asks to download when the button is pressed", async () => {
    const onDownload = vi.fn();
    const { user } = renderForm(onDownload);
    await user.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it("does not submit the page when the form is submitted", async () => {
    const { user } = renderForm();
    const submit = vi.fn();
    screen.getByRole("button", { name: "Download PDF" }).closest("form")!
      .addEventListener("submit", submit);

    await user.type(screen.getByLabelText("Governing law"), "Delaware{Enter}");

    const [event] = submit.mock.calls[0] ?? [];
    expect(event === undefined || (event as SubmitEvent).defaultPrevented).toBe(true);
  });
});
