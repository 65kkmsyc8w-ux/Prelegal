import { describe, expect, it } from "vitest";

import {
  fieldText,
  fillTemplate,
  formatDate,
  formatTermYears,
  formatYears,
  inlineValues,
  orPlaceholder,
  partyValue,
} from "@/lib/fields";
import type { DocumentSpec, FieldSpec } from "@/lib/documents";

const field = (over: Partial<FieldSpec>): FieldSpec => ({
  key: "value",
  label: "Value",
  type: "text",
  prompt: "a value",
  inline: false,
  options: [],
  modes: [],
  ...over,
});

describe("formatDate", () => {
  it("writes an ISO date the way an agreement reads", () => {
    expect(formatDate("2026-08-31")).toBe("31 August 2026");
  });

  it("reads the parts from the string, so the day never slips west of UTC", () => {
    expect(formatDate("2026-01-01")).toBe("1 January 2026");
  });

  it("has nothing to write for a date nobody gave", () => {
    expect(formatDate("")).toBe("");
  });
});

describe("formatYears", () => {
  it("keeps one year singular", () => {
    expect(formatYears(1)).toBe("1 year");
    expect(formatYears(2)).toBe("2 years");
  });

  it("treats a count below one as a length nobody has given", () => {
    expect(formatTermYears(0)).toBe("[Years]");
    expect(formatTermYears(-1)).toBe("[Years]");
    expect(formatTermYears(3)).toBe("3 years");
  });
});

describe("orPlaceholder", () => {
  it("stands a placeholder in for a value not yet given", () => {
    expect(orPlaceholder("", "Purpose")).toBe("[Purpose]");
    expect(orPlaceholder("   ", "Purpose")).toBe("[Purpose]");
    expect(orPlaceholder("Evaluating a deal.", "Purpose")).toBe("Evaluating a deal.");
  });
});

describe("fieldText", () => {
  it("places a plain value as it is", () => {
    expect(fieldText(field({}), "Delaware")).toBe("Delaware");
  });

  it("stands in for a value not yet given", () => {
    expect(fieldText(field({ label: "Governing Law" }), "")).toBe("[Governing Law]");
    expect(fieldText(field({ label: "Governing Law" }), undefined)).toBe(
      "[Governing Law]",
    );
  });

  it("says what a blank field means when blank is an answer", () => {
    expect(fieldText(field({ whenBlank: "None." }), "")).toBe("None.");
  });

  it("writes a date out in full", () => {
    expect(fieldText(field({ type: "date", label: "Effective Date" }), "2026-08-31")).toBe(
      "31 August 2026",
    );
  });

  it("states a duration the way its mode says to", () => {
    const term = field({
      type: "duration",
      modes: [
        {
          value: "expires",
          label: "Expires",
          countedInYears: true,
          template: "Expires {years} from the Effective Date.",
        },
        {
          value: "untilTerminated",
          label: "Until terminated",
          countedInYears: false,
          template: "Continues until terminated.",
        },
      ],
    });

    expect(fieldText(term, { mode: "expires", years: 2 })).toBe(
      "Expires 2 years from the Effective Date.",
    );
    expect(fieldText(term, { mode: "untilTerminated", years: 1 })).toBe(
      "Continues until terminated.",
    );
    expect(fieldText(term, { mode: "expires", years: 0 })).toBe(
      "Expires [Years] from the Effective Date.",
    );
  });

  it("names the option a choice settled on", () => {
    const choice = field({
      type: "choice",
      label: "Payment Process",
      options: [
        { value: "invoice", label: "Invoice" },
        { value: "automatic", label: "Automatic payment" },
      ],
    });

    expect(fieldText(choice, "automatic")).toBe("Automatic payment");
    expect(fieldText(choice, "")).toBe("[Payment Process]");
  });
});

describe("partyValue", () => {
  it("reads a party that is not there as one nobody has named", () => {
    expect(partyValue(undefined)).toEqual({
      name: "",
      title: "",
      company: "",
      noticeAddress: "",
    });
  });
});

describe("inlineValues", () => {
  const spec = {
    fields: [
      field({ key: "governingLaw", label: "Governing Law", inline: true }),
      field({ key: "purpose", label: "Purpose" }),
    ],
  } as DocumentSpec;

  it("offers only the fields a clause may state in its own sentence", () => {
    const values = inlineValues(spec, { governingLaw: "Delaware", purpose: "A deal." });

    expect(values).toEqual({ governingLaw: "Delaware" });
  });
});

describe("fillTemplate", () => {
  it("replaces a token with its value", () => {
    expect(fillTemplate("the laws of {governingLaw}", { governingLaw: "Delaware" })).toBe(
      "the laws of Delaware",
    );
  });

  it("leaves a token nothing answers to alone", () => {
    expect(fillTemplate("the laws of {somewhere}", {})).toBe("the laws of {somewhere}");
  });
});
