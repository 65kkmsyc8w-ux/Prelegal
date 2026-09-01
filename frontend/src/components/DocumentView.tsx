import { CLAUSES_BY_SLUG } from "@/content/generated";
import { DISCLAIMER } from "@/lib/disclaimer";
import type { Clause } from "@/content/clause";
import {
  fieldText,
  fillTemplate,
  inlineValues,
  orPlaceholder,
  partyValue,
} from "@/lib/fields";
import type { DocumentSpec, Fields, FieldSpec } from "@/lib/documents";

interface FieldProps {
  label: string;
  hint?: string | null;
  value: string;
}

const Field = ({ label, hint, value }: FieldProps) => (
  <section className="field">
    <h3>{label}</h3>
    {hint && <p className="hint">{hint}</p>}
    <p>{value}</p>
  </section>
);

interface SignaturesProps {
  parties: FieldSpec[];
  fields: Fields;
}

/** One column per party the document names, however many that is. */
const Signatures = ({ parties, fields }: SignaturesProps) => {
  const held = parties.map((party) => partyValue(fields[party.key]));

  const row = (label: string, of: (party: ReturnType<typeof partyValue>) => string) => (
    <tr>
      <th scope="row">{label}</th>
      {held.map((party, index) => (
        <td key={parties[index].key}>{of(party)}</td>
      ))}
    </tr>
  );

  return (
    <table className="signatures">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">Detail</span>
          </th>
          {parties.map((party, index) => (
            <th scope="col" key={party.key}>
              {orPlaceholder(held[index].company, party.label)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">Signature</th>
          {parties.map((party) => (
            <td key={party.key} />
          ))}
        </tr>
        {row("Print Name", (party) => orPlaceholder(party.name, "Name"))}
        {row("Title", (party) => orPlaceholder(party.title, "Title"))}
        {row("Company", (party) => orPlaceholder(party.company, "Company"))}
        <tr>
          <th scope="row">
            Notice Address
            <span className="hint">Use either email or postal address</span>
          </th>
          {held.map((party, index) => (
            <td key={parties[index].key}>
              {orPlaceholder(party.noticeAddress, "Notice Address")}
            </td>
          ))}
        </tr>
        <tr>
          <th scope="row">Date</th>
          {parties.map((party) => (
            <td key={party.key} />
          ))}
        </tr>
      </tbody>
    </table>
  );
};

interface TermsProps {
  clauses: Clause[];
  values: Record<string, string>;
}

/**
 * The Mutual NDA states each clause in one paragraph. The other ten carry their
 * text in subclauses, so a clause there is a heading over a nested list.
 */
const Terms = ({ clauses, values }: TermsProps) => (
  <ol className="clauses">
    {clauses.map((clause) => (
      <li key={clause.number}>
        <strong>{clause.heading}.</strong>{" "}
        {fillTemplate(clause.body, values)}
        {clause.subclauses.length > 0 && (
          <ol className="subclauses">
            {clause.subclauses.map((subclause) => (
              <li key={subclause.number}>
                {subclause.heading && <strong>{subclause.heading}.</strong>}{" "}
                {fillTemplate(subclause.body, values)}
              </li>
            ))}
          </ol>
        )}
      </li>
    ))}
  </ol>
);

interface DocumentViewProps {
  spec: DocumentSpec;
  fields: Fields;
}

export const DocumentView = ({ spec, fields }: DocumentViewProps) => {
  const values = inlineValues(spec, fields);
  const parties = spec.fields.filter((field) => field.type === "party");
  const stated = spec.fields.filter((field) => field.type !== "party");
  const clauses = CLAUSES_BY_SLUG[spec.slug] ?? [];

  return (
    <article className="document" aria-label={spec.title}>
      <h1>{spec.title}</h1>

      {spec.preamble && (
        <p className="preamble">
          {spec.preamble.split("{source}")[0]}
          <a href={spec.source}>{spec.source.replace("https://", "")}</a>
          {spec.preamble.split("{source}")[1]}
        </p>
      )}

      {/* Inside the article, so the print stylesheet carries it into the PDF
          along with everything else the agreement says. */}
      <p className="document-disclaimer" role="note">
        {DISCLAIMER}
      </p>

      <h2>{spec.coverPageHeading}</h2>

      {stated.map((field) => (
        <Field
          key={field.key}
          label={field.label}
          hint={field.hint}
          value={fieldText(field, fields[field.key])}
        />
      ))}

      {spec.closing && <p>{spec.closing}</p>}

      {parties.length > 0 && <Signatures parties={parties} fields={fields} />}

      <h2>{spec.termsHeading}</h2>

      <Terms clauses={clauses} values={values} />

      <p className="attribution">{spec.attribution}</p>
    </article>
  );
};
