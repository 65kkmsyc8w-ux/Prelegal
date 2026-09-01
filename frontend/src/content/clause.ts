/** The shape scripts/generate-clauses.mjs writes. */
export interface Subclause {
  number: string;
  heading: string;
  body: string;
}

export interface Clause {
  number: string;
  heading: string;
  body: string;
  subclauses: Subclause[];
}
