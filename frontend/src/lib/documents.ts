/**
 * The shape of a document's declaration, as the server sends it.
 *
 * Nothing here describes any particular agreement. The eleven live in
 * documents/<slug>.spec.json and arrive with the chat reply, which is what
 * keeps this side from having to be taught each one by hand.
 */

export type FieldType = "text" | "date" | "money" | "choice" | "duration" | "party";

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface DurationMode {
  value: string;
  label: string;
  countedInYears: boolean;
  template: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  prompt: string;
  hint?: string | null;
  placeholder?: string | null;
  whenBlank?: string | null;
  inline: boolean;
  options: ChoiceOption[];
  modes: DurationMode[];
}

export interface DocumentSpec {
  slug: string;
  title: string;
  shortName: string;
  description: string;
  source: string;
  preamble: string;
  coverPageHeading: string;
  termsHeading: string;
  closing: string;
  attribution: string;
  fields: FieldSpec[];
}

export interface Party {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export interface Duration {
  mode: string;
  years: number;
}

export type FieldValue = string | Party | Duration;

export type Fields = Record<string, FieldValue>;

export const isParty = (value: FieldValue | undefined): value is Party =>
  typeof value === "object" && value !== null && "noticeAddress" in value;

export const isDuration = (value: FieldValue | undefined): value is Duration =>
  typeof value === "object" && value !== null && "mode" in value;
