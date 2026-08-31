"use client";

import type { ChangeEvent } from "react";

import type { NdaDetails, Party } from "@/lib/nda";

type PartyKey = "partyOne" | "partyTwo";

interface YearsFieldProps {
  id: string;
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const YearsField = ({ id, value, onChange }: YearsFieldProps) => (
  <>
    <label htmlFor={id}>Years</label>
    <input
      id={id}
      type="number"
      min={1}
      className="years"
      value={value}
      onChange={onChange}
    />
  </>
);

interface PartyFieldsProps {
  id: string;
  legend: string;
  party: Party;
  onChange: (field: keyof Party, value: string) => void;
}

const PartyFields = ({ id, legend, party, onChange }: PartyFieldsProps) => (
  <fieldset>
    <legend>{legend}</legend>

    <label htmlFor={`${id}-company`}>Company</label>
    <input
      id={`${id}-company`}
      value={party.company}
      onChange={(event) => onChange("company", event.target.value)}
    />

    <label htmlFor={`${id}-name`}>Print name</label>
    <input
      id={`${id}-name`}
      value={party.name}
      onChange={(event) => onChange("name", event.target.value)}
    />

    <label htmlFor={`${id}-title`}>Title</label>
    <input
      id={`${id}-title`}
      value={party.title}
      onChange={(event) => onChange("title", event.target.value)}
    />

    <label htmlFor={`${id}-address`}>Notice address</label>
    <input
      id={`${id}-address`}
      value={party.noticeAddress}
      onChange={(event) => onChange("noticeAddress", event.target.value)}
    />
    <p className="hint">Use either an email or a postal address.</p>
  </fieldset>
);

interface NdaFormProps {
  details: NdaDetails;
  onChange: (details: NdaDetails) => void;
  onDownload: () => void;
}

export const NdaForm = ({ details, onChange, onDownload }: NdaFormProps) => {
  const set = <K extends keyof NdaDetails>(key: K, value: NdaDetails[K]) =>
    onChange({ ...details, [key]: value });

  const setParty = (key: PartyKey) => (field: keyof Party, value: string) =>
    onChange({ ...details, [key]: { ...details[key], [field]: value } });

  const setYears =
    (key: "termYears" | "confidentialityYears") =>
    (event: ChangeEvent<HTMLInputElement>) =>
      set(key, Number(event.target.value));

  return (
    <form className="form" onSubmit={(event) => event.preventDefault()}>
      <fieldset>
        <legend>The agreement</legend>

        <label htmlFor="purpose">Purpose</label>
        <textarea
          id="purpose"
          rows={3}
          placeholder="Evaluating whether to enter into a business relationship with the other party."
          value={details.purpose}
          onChange={(event) => set("purpose", event.target.value)}
        />
        <p className="hint">How Confidential Information may be used.</p>

        <label htmlFor="effective-date">Effective date</label>
        <input
          id="effective-date"
          type="date"
          value={details.effectiveDate}
          onChange={(event) => set("effectiveDate", event.target.value)}
        />
      </fieldset>

      <fieldset>
        <legend>MNDA term</legend>
        <p className="hint">The length of this MNDA.</p>

        <label className="choice">
          <input
            type="radio"
            name="term-kind"
            checked={details.termKind === "expires"}
            onChange={() => set("termKind", "expires")}
          />
          Expires a set number of years from the effective date
        </label>

        <label className="choice">
          <input
            type="radio"
            name="term-kind"
            checked={details.termKind === "untilTerminated"}
            onChange={() => set("termKind", "untilTerminated")}
          />
          Continues until terminated
        </label>

        {details.termKind === "expires" && (
          <YearsField
            id="term-years"
            value={details.termYears}
            onChange={setYears("termYears")}
          />
        )}
      </fieldset>

      <fieldset>
        <legend>Term of confidentiality</legend>
        <p className="hint">How long Confidential Information is protected.</p>

        <label className="choice">
          <input
            type="radio"
            name="confidentiality-kind"
            checked={details.confidentialityKind === "years"}
            onChange={() =>
              set("confidentialityKind", "years")
            }
          />
          A set number of years from the effective date
        </label>

        <label className="choice">
          <input
            type="radio"
            name="confidentiality-kind"
            checked={details.confidentialityKind === "perpetual"}
            onChange={() =>
              set("confidentialityKind", "perpetual")
            }
          />
          In perpetuity
        </label>

        {details.confidentialityKind === "years" && (
          <YearsField
            id="confidentiality-years"
            value={details.confidentialityYears}
            onChange={setYears("confidentialityYears")}
          />
        )}
      </fieldset>

      <fieldset>
        <legend>Governing law</legend>

        <label htmlFor="governing-law">Governing law</label>
        <input
          id="governing-law"
          placeholder="Delaware"
          value={details.governingLaw}
          onChange={(event) => set("governingLaw", event.target.value)}
        />
        <p className="hint">The state whose law governs the agreement.</p>

        <label htmlFor="jurisdiction">Jurisdiction</label>
        <input
          id="jurisdiction"
          placeholder="New Castle, DE"
          value={details.jurisdiction}
          onChange={(event) => set("jurisdiction", event.target.value)}
        />
        <p className="hint">The city or county and state whose courts hear disputes.</p>
      </fieldset>

      <PartyFields
        id="party-1"
        legend="Party 1"
        party={details.partyOne}
        onChange={setParty("partyOne")}
      />
      <PartyFields
        id="party-2"
        legend="Party 2"
        party={details.partyTwo}
        onChange={setParty("partyTwo")}
      />

      <fieldset>
        <legend>Modifications</legend>

        <label htmlFor="modifications">Modifications to the MNDA</label>
        <textarea
          id="modifications"
          rows={3}
          value={details.modifications}
          onChange={(event) => set("modifications", event.target.value)}
        />
        <p className="hint">
          Leave blank if the standard terms are used without change.
        </p>
      </fieldset>

      <button type="button" className="download" onClick={onDownload}>
        Download PDF
      </button>
      <p className="hint">
        Opens your browser print dialog. Choose Save as PDF to keep a copy.
      </p>
    </form>
  );
};
