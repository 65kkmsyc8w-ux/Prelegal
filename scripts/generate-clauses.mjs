/**
 * Turns templates/<slug>.md into the clause data both sides render from:
 *
 *   documents/<slug>.clauses.json          the backend, for the system prompt
 *   frontend/src/content/generated/<slug>.ts   the browser, for the document
 *
 * Run it after changing a template or a spec:
 *
 *   node scripts/generate-clauses.mjs
 *
 * Nothing runs this during a Docker build and templates/ never enters the
 * image. The output is committed like any other source file, and
 * frontend/src/content/generated/generated.test.ts fails if it has gone stale.
 *
 * On substitution: a <span class="..._link">Label</span> is a reference to a
 * defined term, and the agreements are written so that the term itself is what
 * reads correctly in the sentence. So every span becomes its plain label,
 * except the few occurrences a spec names in `inlineOccurrences`, which state
 * their value instead and become {key}. The Mutual NDA needs exactly two, both
 * in clause 9: "the laws of the State of {governingLaw}" states the value,
 * while the second mention in the same sentence refers back to it, and
 * "provisions of such Delaware" is not English.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SPAN = /<span class="(?:coverpage|keyterms|orderform|sow|businessterms)_link"[^>]*>([^<]*)<\/span>/g;
const HEADER_2 = /^(\d+)\.\s+<span class="header_2"[^>]*>(.*?)<\/span>\s*(.*)$/;
const FLAT = /^(\d+)\.\s+\*\*(.+?)\*\*\.\s*(.*)$/;
// The Software License Agreement writes its Definitions section as a bare
// numbered title rather than a header_2 span. It is the only one, and without
// this its whole section is filed under the section before it.
const PLAIN_SECTION = /^(\d+)\.\s+([A-Z][A-Za-z &']*)$/;
// Any indented list item under a section. Most are numbered and carry a
// header_3 span; a Definitions entry carries an empty anchor span instead.
// Three levels appear across the eleven templates, and only these: numbered at
// four spaces, lettered at eight, roman or lettered at twelve.
const SUBCLAUSE = /^( +)([0-9]+|[ivx]+|[a-z])\.\s+(.*)$/;
const LEAD_HEADED = /^<span class="header_3"[^>]*>(.*?)<\/span>\s*(.*)$/;
const LEAD_ANCHOR = /^<span[^>]*><\/span>\s*(.*)$/;
const INDENT = 4;

/** Strips the markup the templates carry that a printed agreement has no use for. */
const plain = (text) =>
  text
    .replace(/<\/?span[^>]*>/g, "")
    .replace(/\*\*/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();

/**
 * Replaces each reference span with its label, or with {key} where the spec
 * says that occurrence states its value. Occurrences are counted per label
 * within the clause, which is the unit `inlineOccurrences` names.
 */
const substitute = (text, clauseHeading, inlineOccurrences) => {
  const seen = new Map();
  return text.replace(SPAN, (_match, label) => {
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    const inline = inlineOccurrences.find(
      (entry) =>
        entry.clause === clauseHeading &&
        entry.label === label &&
        entry.occurrence === count,
    );
    return inline ? `{${inline.key}}` : label;
  });
};

/** Drops the trailing full stop a subclause heading carries in the source. */
const heading = (text) => plain(text).replace(/\.$/, "");

/**
 * The Mutual NDA states each clause in a single paragraph. The other ten carry
 * their text in subclauses under a numbered section, so a clause there has a
 * heading and subclauses but no body of its own.
 */
export const parseTemplate = (markdown, spec) => {
  const inline = spec.inlineOccurrences ?? [];
  const clauses = [];
  let current = null;
  // The number of the last subclause seen at each depth, so a nested item is
  // numbered under the one it sits beneath.
  const trail = [];

  // design-partner-agreement.md is the one template saved with CRLF endings. A
  // trailing \r is a line terminator to the regex engine, so every subclause
  // pattern below would fail to reach the end of the line.
  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const flat = FLAT.exec(line);
    if (flat) {
      const [, number, name, body] = flat;
      clauses.push({
        number,
        heading: heading(name),
        body: plain(substitute(body, heading(name), inline)),
        subclauses: [],
      });
      continue;
    }

    const section = HEADER_2.exec(line) ?? PLAIN_SECTION.exec(line);
    if (section) {
      const [, number, name, trailing = ""] = section;
      current = {
        number,
        heading: heading(name),
        body: plain(substitute(trailing, heading(name), inline)),
        subclauses: [],
      };
      clauses.push(current);
      trail.length = 0;
      continue;
    }

    const sub = SUBCLAUSE.exec(line);
    if (sub && current) {
      const [, indent, marker, rest] = sub;
      const headed = LEAD_HEADED.exec(rest);
      const anchor = headed ? null : LEAD_ANCHOR.exec(rest);
      const name = headed ? heading(headed[1]) : "";
      const text = headed ? headed[2] : anchor ? anchor[1] : rest;
      const depth = Math.floor(indent.length / INDENT);
      const number = `${trail[depth - 1] ?? current.number}.${marker}`;
      trail[depth] = number;
      current.subclauses.push({
        number,
        heading: name,
        body: plain(substitute(text, current.heading, inline)),
      });
    }
  }

  return clauses;
};

const specs = () =>
  readdirSync(join(ROOT, "documents"))
    .filter((name) => name.endsWith(".spec.json"))
    .map((name) =>
      JSON.parse(readFileSync(join(ROOT, "documents", name), "utf8")),
    );

/** The template a document's terms come from. The Mutual NDA's cover page is a
 * separate file and is not a source of clauses. */
const templateFor = (slug) => join(ROOT, "templates", `${slug}.md`);

const asModule = (slug, clauses) =>
  `// Generated from templates/${slug}.md by scripts/generate-clauses.mjs.\n` +
  `// Do not edit by hand; run the generator instead.\n\n` +
  `import type { Clause } from "@/content/clause";\n\n` +
  `export const CLAUSES: Clause[] = ${JSON.stringify(clauses, null, 2)};\n`;

const main = () => {
  const generated = join(ROOT, "frontend", "src", "content", "generated");
  mkdirSync(generated, { recursive: true });
  const built = [];

  for (const spec of specs()) {
    const markdown = readFileSync(templateFor(spec.slug), "utf8");
    const clauses = parseTemplate(markdown, spec);
    if (clauses.length === 0) {
      throw new Error(`${spec.slug}: parsed no clauses`);
    }
    writeFileSync(
      join(ROOT, "documents", `${spec.slug}.clauses.json`),
      `${JSON.stringify(clauses, null, 2)}\n`,
    );
    writeFileSync(
      join(generated, `${spec.slug}.ts`),
      asModule(spec.slug, clauses),
    );
    built.push(spec.slug);
    const units = clauses.reduce((n, c) => n + 1 + c.subclauses.length, 0);
    console.log(`${spec.slug}: ${clauses.length} clauses, ${units} units`);
  }

  built.sort();
  const index =
    `// Generated by scripts/generate-clauses.mjs. Do not edit by hand.\n\n` +
    built.map((s) => `import { CLAUSES as ${camel(s)} } from "./${s}";`).join("\n") +
    `\nimport type { Clause } from "@/content/clause";\n\n` +
    `export const CLAUSES_BY_SLUG: Record<string, Clause[]> = {\n` +
    built.map((s) => `  "${s}": ${camel(s)},`).join("\n") +
    `\n};\n`;
  writeFileSync(join(generated, "index.ts"), index);
};

export const camel = (slug) =>
  slug.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
