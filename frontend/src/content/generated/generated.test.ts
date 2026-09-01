import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// The generator itself, so this re-parses the templates rather than trusting
// whoever last ran it.
import { parseTemplate } from "../../../scripts/generate-clauses.mjs";

import { CLAUSES_BY_SLUG } from "@/content/generated";

const slugs = readdirSync("../documents")
  .filter((name) => name.endsWith(".spec.json"))
  .map((name) => name.replace(".spec.json", ""));

describe("the generated terms", () => {
  it("cover every document that declares itself", () => {
    expect(Object.keys(CLAUSES_BY_SLUG).sort()).toEqual(slugs.sort());
  });

  it.each(slugs)("still match templates/%s.md", (slug) => {
    const spec = JSON.parse(readFileSync(`../documents/${slug}.spec.json`, "utf8"));
    const markdown = readFileSync(`../templates/${slug}.md`, "utf8");

    expect(CLAUSES_BY_SLUG[slug]).toEqual(parseTemplate(markdown, spec));
  });

  it.each(slugs)("leave %s with no markup the parser should have taken", (slug) => {
    for (const clause of CLAUSES_BY_SLUG[slug]) {
      for (const text of [
        clause.heading,
        clause.body,
        ...clause.subclauses.flatMap((s) => [s.heading, s.body]),
      ]) {
        expect(text).not.toContain("<span");
        expect(text).not.toContain("**");
      }
    }
  });

  it.each(slugs)("substitute a value in %s only where its spec says to", (slug) => {
    const spec = JSON.parse(readFileSync(`../documents/${slug}.spec.json`, "utf8"));
    const expected = new Set(
      spec.inlineOccurrences.map((o: { key: string }) => `{${o.key}}`),
    );
    const found = new Set<string>();
    for (const clause of CLAUSES_BY_SLUG[slug]) {
      for (const text of [
        clause.body,
        ...clause.subclauses.map((s) => s.body),
      ]) {
        for (const token of text.match(/\{\w+\}/g) ?? []) {
          found.add(token);
        }
      }
    }

    expect(found).toEqual(expected);
  });
});
