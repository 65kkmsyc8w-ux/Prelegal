import type { NdaDetails } from "@/lib/nda";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Formats an ISO date (yyyy-mm-dd) as "31 August 2026". The parts are read from
 * the string rather than through Date, because Date parses a bare ISO date as
 * UTC midnight and would show the previous day west of UTC.
 */
export const formatDate = (isoDate: string): string => {
  if (isoDate === "") {
    return "";
  }
  const [year, month, day] = isoDate.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

export const formatYears = (years: number): string =>
  years === 1 ? "1 year" : `${years} years`;

/**
 * A number input reports an empty box as 0 and accepts a typed negative, and
 * neither is a term anyone can agree to. Both read as unfilled, like any other
 * value the user has yet to give.
 */
export const formatTermYears = (years: number): string =>
  years >= 1 ? formatYears(years) : "[Years]";

/** Returns the value, or the placeholder that stands in for it while it is blank. */
export const orPlaceholder = (value: string, placeholder: string): string =>
  value.trim() === "" ? `[${placeholder}]` : value;

export interface DocumentValues {
  purpose: string;
  effectiveDate: string;
  mndaTerm: string;
  termOfConfidentiality: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
}

export const documentValues = (details: NdaDetails): DocumentValues => ({
  purpose: orPlaceholder(details.purpose, "Purpose"),
  effectiveDate: orPlaceholder(formatDate(details.effectiveDate), "Effective Date"),
  mndaTerm:
    details.termKind === "expires"
      ? `Expires ${formatTermYears(details.termYears)} from the Effective Date.`
      : "Continues until terminated in accordance with the terms of this MNDA.",
  termOfConfidentiality:
    details.confidentialityKind === "years"
      ? `${formatTermYears(details.confidentialityYears)} from the Effective Date, but in the case of trade secrets until the Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.",
  governingLaw: orPlaceholder(details.governingLaw, "Governing Law"),
  jurisdiction: orPlaceholder(details.jurisdiction, "Jurisdiction"),
  modifications:
    details.modifications.trim() === "" ? "None." : details.modifications,
});

/** Replaces every {token} in the text with the matching document value. */
export const fillTemplate = (text: string, values: DocumentValues): string =>
  text.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = values[key as keyof DocumentValues];
    return value === undefined ? token : value;
  });
