import {
  isDuration,
  isParty,
  type Fields,
  type FieldSpec,
  type FieldValue,
  type DocumentSpec,
} from "@/lib/documents";

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
 * A count of years the user has not given yet reads as unfilled, like any other
 * blank. Zero is what an empty number reports and a negative is not a term
 * anyone can agree to, so neither is a length.
 */
export const formatTermYears = (years: number): string =>
  years >= 1 ? formatYears(years) : "[Years]";

/** Returns the value, or the placeholder that stands in for it while it is blank. */
export const orPlaceholder = (value: string, placeholder: string): string =>
  value.trim() === "" ? `[${placeholder}]` : value;

const standsInAs = (field: FieldSpec) => field.placeholder ?? field.label;

/** How one field reads on the cover page, filled or not. */
export const fieldText = (
  field: FieldSpec,
  value: FieldValue | undefined,
): string => {
  if (field.type === "duration") {
    const held = isDuration(value) ? value : { mode: "", years: 0 };
    const mode =
      field.modes.find((candidate) => candidate.value === held.mode) ??
      field.modes[0];
    return mode.template.replace("{years}", formatTermYears(held.years));
  }

  if (field.type === "choice") {
    const chosen = field.options.find((option) => option.value === value);
    return chosen ? chosen.label : `[${standsInAs(field)}]`;
  }

  const text = typeof value === "string" ? value : "";
  if (text.trim() === "" && field.whenBlank) {
    return field.whenBlank;
  }
  if (field.type === "date") {
    return orPlaceholder(formatDate(text), standsInAs(field));
  }
  return orPlaceholder(text, standsInAs(field));
};

export const partyValue = (value: FieldValue | undefined) =>
  isParty(value) ? value : { name: "", title: "", company: "", noticeAddress: "" };

/**
 * The values a clause can state in its own sentence. Only the few fields a spec
 * marks inline appear here; every other reference in the terms is a defined
 * term that reads correctly as itself.
 */
export const inlineValues = (
  spec: DocumentSpec,
  fields: Fields,
): Record<string, string> =>
  Object.fromEntries(
    spec.fields
      .filter((field) => field.inline)
      .map((field) => [field.key, fieldText(field, fields[field.key])]),
  );

/** Replaces every {token} in the text with the matching value. */
export const fillTemplate = (
  text: string,
  values: Record<string, string>,
): string =>
  text.replace(/\{(\w+)\}/g, (token, key: string) =>
    values[key] === undefined ? token : values[key],
  );
