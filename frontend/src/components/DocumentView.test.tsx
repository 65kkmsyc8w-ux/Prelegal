import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocumentView } from "@/components/DocumentView";
import { CLAUSES_BY_SLUG } from "@/content/generated";
import type { DocumentSpec, Fields } from "@/lib/documents";

/** The real declarations, so these tests fail if a spec stops making sense. */
const spec = (slug: string): DocumentSpec =>
  JSON.parse(readFileSync(`../documents/${slug}.spec.json`, "utf8"));

const NDA = spec("mutual-nda");
const PILOT = spec("pilot-agreement");

const completed: Fields = {
  purpose: "Evaluating a supply arrangement.",
  effectiveDate: "2026-08-31",
  term: { mode: "expires", years: 2 },
  confidentiality: { mode: "years", years: 5 },
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

describe("the Mutual NDA", () => {
  it("titles the agreement", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Mutual Non-Disclosure Agreement" }),
    ).toBeInTheDocument();
  });

  it("shows both halves of the agreement", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    expect(screen.getByRole("heading", { name: "Cover Page" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Standard Terms" })).toBeInTheDocument();
  });

  it("states every cover page value the user gave", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    const text = documentText();
    expect(text).toContain("Evaluating a supply arrangement.");
    expect(text).toContain("31 August 2026");
    expect(text).toContain("Expires 2 years from the Effective Date.");
    expect(text).toContain("5 years from the Effective Date");
    expect(text).toContain("Section 8 is deleted.");
  });

  it("marks each unfilled value with its own placeholder", () => {
    render(<DocumentView spec={NDA} fields={{}} />);
    const text = documentText();
    expect(text).toContain("[Purpose]");
    expect(text).toContain("[Effective Date]");
    expect(text).toContain("[Governing Law]");
    expect(text).toContain("[Jurisdiction]");
  });

  it("says there are no modifications rather than showing a gap", () => {
    render(<DocumentView spec={NDA} fields={{}} />);
    expect(documentText()).toContain("None.");
    expect(documentText()).not.toContain("[MNDA Modifications]");
  });

  it("states a perpetual confidentiality term", () => {
    render(
      <DocumentView
        spec={NDA}
        fields={{ ...completed, confidentiality: { mode: "perpetual", years: 1 } }}
      />,
    );
    expect(documentText()).toContain("In perpetuity.");
  });

  it("states a term that runs until termination", () => {
    render(
      <DocumentView
        spec={NDA}
        fields={{ ...completed, term: { mode: "untilTerminated", years: 1 } }}
      />,
    );
    expect(documentText()).toContain("Continues until terminated");
  });

  it("carries every clause of the standard terms", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    const clauses = CLAUSES_BY_SLUG["mutual-nda"];
    expect(screen.getAllByRole("listitem")).toHaveLength(clauses.length);
    for (const clause of clauses) {
      expect(documentText()).toContain(clause.heading);
    }
  });

  it("puts the governing law and jurisdiction into the clause that states them", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    const text = documentText();
    expect(text).toContain("the laws of the State of Delaware");
    expect(text).toContain("courts located in New Castle, DE");
  });

  it("refers back to the cover page terms in the second half of clause 9", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    const text = documentText();
    expect(text).toContain("conflict of laws provisions of such Governing Law");
    expect(text).toContain("exclusive jurisdiction of such Jurisdiction");
  });

  it("never states a term of zero years", () => {
    render(
      <DocumentView
        spec={NDA}
        fields={{ ...completed, term: { mode: "expires", years: 0 } }}
      />,
    );
    expect(documentText()).toContain("Expires [Years] from the Effective Date.");
    expect(documentText()).not.toContain("0 years");
  });

  it("names the parties by company in the signature table", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    expect(screen.getByRole("columnheader", { name: "Acme Inc" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Beta Ltd" })).toBeInTheDocument();
  });

  it("falls back to Party 1 and Party 2 before the companies are named", () => {
    render(<DocumentView spec={NDA} fields={{}} />);
    expect(screen.getByRole("columnheader", { name: "[Party 1]" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "[Party 2]" })).toBeInTheDocument();
  });

  it("puts each party's details in its own column", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    const cells = within(
      screen.getByRole("row", { name: /Print Name/ }),
    ).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Ada Lovelace");
    expect(cells[1]).toHaveTextContent("Grace Hopper");
  });

  it("leaves the signature and date rows blank to be signed", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    for (const label of [/^Signature/, /^Date/]) {
      const cells = within(screen.getByRole("row", { name: label })).getAllByRole("cell");
      expect(cells).toHaveLength(2);
      expect(cells[0]).toBeEmptyDOMElement();
      expect(cells[1]).toBeEmptyDOMElement();
    }
  });

  it("keeps the attribution the template licence requires", () => {
    render(<DocumentView spec={NDA} fields={completed} />);
    expect(documentText()).toContain("free to use under CC BY 4.0");
  });
});

describe("any other agreement", () => {
  it("renders from its own declaration alone", () => {
    render(<DocumentView spec={PILOT} fields={{}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Pilot Agreement" }),
    ).toBeInTheDocument();
    for (const field of PILOT.fields.filter((f) => f.type !== "party")) {
      expect(screen.getByRole("heading", { name: field.label })).toBeInTheDocument();
    }
  });

  it("states the values it is given", () => {
    render(
      <DocumentView
        spec={PILOT}
        fields={{ governingLaw: "Delaware", pilotPeriod: "60 days" }}
      />,
    );
    expect(documentText()).toContain("Delaware");
    expect(documentText()).toContain("60 days");
  });

  it("nests the subclauses its terms are written in", () => {
    render(<DocumentView spec={PILOT} fields={{}} />);
    const clauses = CLAUSES_BY_SLUG["pilot-agreement"];
    const units = clauses.reduce((n, c) => n + 1 + c.subclauses.length, 0);
    expect(screen.getAllByRole("listitem")).toHaveLength(units);
  });

  it("leaves a defined term as itself rather than substituting a value", () => {
    render(<DocumentView spec={PILOT} fields={{ pilotPeriod: "60 days" }} />);
    // The terms refer to the Pilot Period; only the cover page states it.
    expect(documentText()).toContain("Pilot Period");
  });
});

describe("every agreement", () => {
  const slugs = Object.keys(CLAUSES_BY_SLUG);

  it.each(slugs)("leaves no token unfilled in %s", (slug) => {
    render(<DocumentView spec={spec(slug)} fields={{}} />);
    expect(documentText()).not.toMatch(/\{\w+\}/);
  });

  it.each(slugs)("names %s and carries its terms", (slug) => {
    const declared = spec(slug);
    render(<DocumentView spec={declared} fields={{}} />);
    expect(
      screen.getByRole("heading", { level: 1, name: declared.title }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
