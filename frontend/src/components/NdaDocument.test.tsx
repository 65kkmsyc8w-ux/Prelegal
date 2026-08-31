import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NdaDocument } from "@/components/NdaDocument";
import { STANDARD_TERMS } from "@/content/standard-terms";
import { emptyNda, type NdaDetails } from "@/lib/nda";

const completed: NdaDetails = {
  purpose: "Evaluating a supply arrangement.",
  effectiveDate: "2026-08-31",
  termKind: "expires",
  termYears: 2,
  confidentialityKind: "years",
  confidentialityYears: 5,
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  modifications: "Section 8 is deleted.",
  partyOne: {
    company: "Acme Inc",
    name: "Ada Lovelace",
    title: "CEO",
    noticeAddress: "ada@acme.example",
  },
  partyTwo: {
    company: "Beta Ltd",
    name: "Grace Hopper",
    title: "CTO",
    noticeAddress: "grace@beta.example",
  },
};

/** The rendered document as one string, for assertions that span elements. */
const documentText = () => screen.getByRole("article").textContent ?? "";

describe("NdaDocument", () => {
  it("titles the agreement", () => {
    render(<NdaDocument details={completed} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" }),
    ).toBeInTheDocument();
  });

  it("shows both halves of the agreement", () => {
    render(<NdaDocument details={completed} />);
    expect(screen.getByRole("heading", { name: "Cover Page" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
  });

  it("states every cover page value the user gave", () => {
    render(<NdaDocument details={completed} />);
    const text = documentText();
    expect(text).toContain("Evaluating a supply arrangement.");
    expect(text).toContain("31 August 2026");
    expect(text).toContain("Expires 2 years from the Effective Date.");
    expect(text).toContain("5 years from the Effective Date");
    expect(text).toContain("Section 8 is deleted.");
  });

  it("marks each unfilled value with its own placeholder", () => {
    render(<NdaDocument details={emptyNda()} />);
    const text = documentText();
    expect(text).toContain("[Purpose]");
    expect(text).toContain("[Effective Date]");
    expect(text).toContain("[Governing Law]");
    expect(text).toContain("[Jurisdiction]");
  });

  it("says there are no modifications rather than showing a gap", () => {
    render(<NdaDocument details={emptyNda()} />);
    expect(documentText()).toContain("None.");
    expect(documentText()).not.toContain("[Modifications]");
  });

  it("states a perpetual confidentiality term", () => {
    render(
      <NdaDocument details={{ ...completed, confidentialityKind: "perpetual" }} />,
    );
    expect(documentText()).toContain("In perpetuity.");
  });

  it("states a term that runs until termination", () => {
    render(<NdaDocument details={{ ...completed, termKind: "untilTerminated" }} />);
    expect(documentText()).toContain("Continues until terminated");
  });

  it("carries every clause of the standard terms", () => {
    render(<NdaDocument details={completed} />);
    const clauses = screen.getAllByRole("listitem");
    expect(clauses).toHaveLength(STANDARD_TERMS.length);
    for (const clause of STANDARD_TERMS) {
      expect(documentText()).toContain(clause.heading);
    }
  });

  it("puts the governing law and jurisdiction into the clause that states them", () => {
    render(<NdaDocument details={completed} />);
    const text = documentText();
    expect(text).toContain("the laws of the State of Delaware");
    expect(text).toContain("courts located in New Castle, DE");
  });

  it("refers back to the cover page terms in the second half of clause 9", () => {
    render(<NdaDocument details={completed} />);
    const text = documentText();
    expect(text).toContain("conflict of laws provisions of such Governing Law");
    expect(text).toContain("exclusive jurisdiction of such Jurisdiction");
  });

  it("never states a term of zero years", () => {
    render(<NdaDocument details={{ ...completed, termYears: 0 }} />);
    expect(documentText()).toContain("Expires [Years] from the Effective Date.");
    expect(documentText()).not.toContain("0 years");
  });

  it("leaves no token unfilled anywhere in the document", () => {
    render(<NdaDocument details={completed} />);
    expect(documentText()).not.toMatch(/\{\w+\}/);
  });

  it("names the parties by company in the signature table", () => {
    render(<NdaDocument details={completed} />);
    expect(screen.getByRole("columnheader", { name: "Acme Inc" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Beta Ltd" })).toBeInTheDocument();
  });

  it("falls back to Party 1 and Party 2 before the companies are named", () => {
    render(<NdaDocument details={emptyNda()} />);
    expect(
      screen.getByRole("columnheader", { name: "[Party 1]" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "[Party 2]" }),
    ).toBeInTheDocument();
  });

  it("puts each party's details in its own column", () => {
    render(<NdaDocument details={completed} />);
    const nameRow = screen.getByRole("row", { name: /Print Name/ });
    const cells = within(nameRow).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Ada Lovelace");
    expect(cells[1]).toHaveTextContent("Grace Hopper");
  });

  it("leaves the signature and date rows blank to be signed", () => {
    render(<NdaDocument details={completed} />);
    for (const label of [/^Signature/, /^Date/]) {
      const cells = within(screen.getByRole("row", { name: label })).getAllByRole("cell");
      expect(cells).toHaveLength(2);
      expect(cells[0]).toBeEmptyDOMElement();
      expect(cells[1]).toBeEmptyDOMElement();
    }
  });

  it("keeps the attribution the template licence requires", () => {
    render(<NdaDocument details={completed} />);
    expect(documentText()).toContain("free to use under CC BY 4.0");
  });
});
