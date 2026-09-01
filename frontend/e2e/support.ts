import { expect, type Page } from "@playwright/test";

export interface DraftDetails {
  purpose: string;
  effectiveDate: string;
  governingLaw: string;
  jurisdiction: string;
  partyOne: { company: string; name: string; title: string; address: string };
  partyTwo: { company: string; name: string; title: string; address: string };
}

export const A_DRAFT: DraftDetails = {
  purpose: "Evaluating a supply arrangement.",
  effectiveDate: "2026-08-31",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  partyOne: {
    company: "Acme Inc",
    name: "Ada Lovelace",
    title: "CEO",
    address: "ada@acme.example",
  },
  partyTwo: {
    company: "Beta Ltd",
    name: "Grace Hopper",
    title: "CTO",
    address: "grace@beta.example",
  },
};

/** Fills the whole form, the way a user completing an agreement would. */
export const fillDraft = async (page: Page, draft: DraftDetails = A_DRAFT) => {
  await page.getByLabel("Purpose", { exact: true }).fill(draft.purpose);
  await page.getByLabel("Effective date", { exact: true }).fill(draft.effectiveDate);
  await page.getByLabel("Governing law", { exact: true }).fill(draft.governingLaw);
  await page.getByLabel("Jurisdiction", { exact: true }).fill(draft.jurisdiction);

  for (const [legend, party] of [
    ["Party 1", draft.partyOne],
    ["Party 2", draft.partyTwo],
  ] as const) {
    const fields = page.getByRole("group", { name: legend });
    await fields.getByLabel("Company", { exact: true }).fill(party.company);
    await fields.getByLabel("Print name", { exact: true }).fill(party.name);
    await fields.getByLabel("Title", { exact: true }).fill(party.title);
    await fields.getByLabel("Notice address", { exact: true }).fill(party.address);
  }
};

/**
 * Signs in and lands on the platform. There is no password yet: the login
 * screen only carries a name, and signing in under a name already used returns
 * to that same account, so a repeated run adds no rows.
 */
export const signIn = async (page: Page, name = "e2e") => {
  await page.goto("/login/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Signed in as ${name}`)).toBeVisible();
};
