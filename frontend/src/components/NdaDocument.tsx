import { ATTRIBUTION, STANDARD_TERMS } from "@/content/standard-terms";
import { documentValues, fillTemplate, orPlaceholder } from "@/lib/fill";
import type { NdaDetails, Party } from "@/lib/nda";

interface FieldProps {
  label: string;
  hint?: string;
  value: string;
}

const Field = ({ label, hint, value }: FieldProps) => (
  <section className="field">
    <h3>{label}</h3>
    {hint && <p className="hint">{hint}</p>}
    <p>{value}</p>
  </section>
);

const partyName = (party: Party, fallback: string) =>
  orPlaceholder(party.company, fallback);

interface NdaDocumentProps {
  details: NdaDetails;
}

export const NdaDocument = ({ details }: NdaDocumentProps) => {
  const values = documentValues(details);
  const { partyOne, partyTwo } = details;

  return (
    <article className="document">
      <h1>Mutual Non-Disclosure Agreement</h1>

      <p className="preamble">
        This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover
        Page (“Cover Page”) and (2) the Common Paper Mutual NDA Standard Terms Version
        1.0 (“Standard Terms”) identical to those posted at{" "}
        <a href="https://commonpaper.com/standards/mutual-nda/1.0">
          commonpaper.com/standards/mutual-nda/1.0
        </a>
        . Any modifications of the Standard Terms should be made on the Cover Page,
        which will control over conflicts with the Standard Terms.
      </p>

      <h2>Cover Page</h2>

      <Field
        label="Purpose"
        hint="How Confidential Information may be used"
        value={values.purpose}
      />
      <Field label="Effective Date" value={values.effectiveDate} />
      <Field
        label="MNDA Term"
        hint="The length of this MNDA"
        value={values.mndaTerm}
      />
      <Field
        label="Term of Confidentiality"
        hint="How long Confidential Information is protected"
        value={values.termOfConfidentiality}
      />
      <Field label="Governing Law" value={values.governingLaw} />
      <Field label="Jurisdiction" value={values.jurisdiction} />
      <Field label="MNDA Modifications" value={values.modifications} />

      <p>
        By signing this Cover Page, each party agrees to enter into this MNDA as of the
        Effective Date.
      </p>

      <table className="signatures">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Detail</span>
            </th>
            <th scope="col">{partyName(partyOne, "Party 1")}</th>
            <th scope="col">{partyName(partyTwo, "Party 2")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Signature</th>
            <td />
            <td />
          </tr>
          <tr>
            <th scope="row">Print Name</th>
            <td>{orPlaceholder(partyOne.name, "Name")}</td>
            <td>{orPlaceholder(partyTwo.name, "Name")}</td>
          </tr>
          <tr>
            <th scope="row">Title</th>
            <td>{orPlaceholder(partyOne.title, "Title")}</td>
            <td>{orPlaceholder(partyTwo.title, "Title")}</td>
          </tr>
          <tr>
            <th scope="row">Company</th>
            <td>{orPlaceholder(partyOne.company, "Company")}</td>
            <td>{orPlaceholder(partyTwo.company, "Company")}</td>
          </tr>
          <tr>
            <th scope="row">
              Notice Address
              <span className="hint">Use either email or postal address</span>
            </th>
            <td>{orPlaceholder(partyOne.noticeAddress, "Notice Address")}</td>
            <td>{orPlaceholder(partyTwo.noticeAddress, "Notice Address")}</td>
          </tr>
          <tr>
            <th scope="row">Date</th>
            <td />
            <td />
          </tr>
        </tbody>
      </table>

      <h2>Standard Terms</h2>

      <ol className="clauses">
        {STANDARD_TERMS.map((clause) => (
          <li key={clause.heading}>
            <strong>{clause.heading}.</strong> {fillTemplate(clause.body, values)}
          </li>
        ))}
      </ol>

      <p className="attribution">{ATTRIBUTION}</p>
    </article>
  );
};
