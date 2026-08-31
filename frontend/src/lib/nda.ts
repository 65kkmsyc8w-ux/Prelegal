export type TermKind = "expires" | "untilTerminated";

export type ConfidentialityKind = "years" | "perpetual";

export interface Party {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export interface NdaDetails {
  purpose: string;
  effectiveDate: string;
  termKind: TermKind;
  termYears: number;
  confidentialityKind: ConfidentialityKind;
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  partyOne: Party;
  partyTwo: Party;
}

const emptyParty = (): Party => ({
  name: "",
  title: "",
  company: "",
  noticeAddress: "",
});

export const emptyNda = (): NdaDetails => ({
  purpose: "",
  effectiveDate: "",
  termKind: "expires",
  termYears: 1,
  confidentialityKind: "years",
  confidentialityYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  partyOne: emptyParty(),
  partyTwo: emptyParty(),
});
