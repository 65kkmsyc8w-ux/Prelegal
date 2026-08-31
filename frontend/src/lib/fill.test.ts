import { describe, expect, it } from "vitest";

import { STANDARD_TERMS } from "@/content/standard-terms";
import {
  documentValues,
  fillTemplate,
  formatDate,
  formatYears,
  orPlaceholder,
} from "@/lib/fill";
import { emptyNda } from "@/lib/nda";

describe("formatDate", () => {
  it("writes an ISO date in long form", () => {
    expect(formatDate("2026-08-31")).toBe("31 August 2026");
  });

  it("drops the leading zero from the day", () => {
    expect(formatDate("2026-01-05")).toBe("5 January 2026");
  });

  it("keeps the calendar day rather than shifting it into another time zone", () => {
    expect(formatDate("2026-01-01")).toBe("1 January 2026");
  });

  it("returns nothing for a date that has not been chosen", () => {
    expect(formatDate("")).toBe("");
  });
});

describe("formatYears", () => {
  it("uses the singular for one year", () => {
    expect(formatYears(1)).toBe("1 year");
  });

  it("uses the plural for more than one", () => {
    expect(formatYears(3)).toBe("3 years");
  });
});

describe("orPlaceholder", () => {
  it("keeps a value that has been filled in", () => {
    expect(orPlaceholder("Delaware", "Governing Law")).toBe("Delaware");
  });

  it("stands in for a blank value", () => {
    expect(orPlaceholder("", "Governing Law")).toBe("[Governing Law]");
  });

  it("treats whitespace as blank", () => {
    expect(orPlaceholder("   ", "Governing Law")).toBe("[Governing Law]");
  });
});

describe("documentValues", () => {
  const details = {
    ...emptyNda(),
    purpose: "Evaluating a business relationship.",
    effectiveDate: "2026-08-31",
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
  };

  it("states a fixed term as an expiry", () => {
    expect(documentValues(details).mndaTerm).toBe(
      "Expires 1 year from the Effective Date.",
    );
  });

  it("states an open ended term as running until termination", () => {
    const values = documentValues({ ...details, termKind: "untilTerminated" });
    expect(values.mndaTerm).toBe(
      "Continues until terminated in accordance with the terms of this MNDA.",
    );
  });

  it("carries the trade secret carve out on a fixed confidentiality term", () => {
    const values = documentValues({ ...details, confidentialityYears: 5 });
    expect(values.termOfConfidentiality).toContain("5 years from the Effective Date");
    expect(values.termOfConfidentiality).toContain("trade secret");
  });

  it("states a perpetual confidentiality term without a carve out", () => {
    const values = documentValues({ ...details, confidentialityKind: "perpetual" });
    expect(values.termOfConfidentiality).toBe("In perpetuity.");
  });

  it("says so when no modifications were made", () => {
    expect(documentValues(details).modifications).toBe("None.");
  });

  it("marks every unfilled value with its own placeholder", () => {
    const values = documentValues(emptyNda());
    expect(values.purpose).toBe("[Purpose]");
    expect(values.effectiveDate).toBe("[Effective Date]");
    expect(values.governingLaw).toBe("[Governing Law]");
    expect(values.jurisdiction).toBe("[Jurisdiction]");
  });
});

describe("fillTemplate", () => {
  const values = documentValues({
    ...emptyNda(),
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
  });

  it("puts the governing law and jurisdiction into the clause that states them", () => {
    const clause = STANDARD_TERMS.find(
      (candidate) => candidate.heading === "Governing Law and Jurisdiction",
    );
    const filled = fillTemplate(clause!.body, values);
    expect(filled).toContain("the laws of the State of Delaware");
    expect(filled).toContain("courts located in New Castle, DE");
    expect(filled).not.toContain("{");
  });

  it("leaves text alone when it holds no tokens", () => {
    expect(fillTemplate("No tokens here.", values)).toBe("No tokens here.");
  });

  it("leaves a token no document value answers to", () => {
    expect(fillTemplate("{unknown}", values)).toBe("{unknown}");
  });

  it("leaves no token unfilled anywhere in the standard terms", () => {
    const filled = STANDARD_TERMS.map((clause) => fillTemplate(clause.body, values));
    expect(filled.join(" ")).not.toMatch(/\{\w+\}/);
  });
});
