import { readFileSync } from "node:fs";

import { expect, type Page } from "@playwright/test";

export const GREETING = "What kind of agreement do you need?";

/** The real declarations, so the stub answers with what the server would. */
export const spec = (slug: string) =>
  JSON.parse(readFileSync(`../documents/${slug}.spec.json`, "utf8"));

export const NDA = spec("mutual-nda");

/** A cover page with nothing left to settle. */
export const A_DRAFT: Record<string, unknown> = {
  purpose: "Evaluating a supply arrangement.",
  effectiveDate: "2026-08-31",
  term: { mode: "expires", years: 2 },
  confidentiality: { mode: "years", years: 5 },
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  modifications: "",
  partyOne: {
    company: "Acme Inc",
    name: "Ada Lovelace",
    title: "CEO",
    noticeAddress: "ada@acme.example",
  },
  partyTwo: {
    company: "Beta Ltd",
    name: "Grace Hopper",
    title: "CTO",
    noticeAddress: "grace@beta.example",
  },
};

export interface Answer {
  reply: string;
  document?: string | null;
  documentSpec?: unknown;
  fields?: Record<string, unknown>;
}

/** An answer that is drafting the given document. */
export const drafting = (
  reply: string,
  fields: Record<string, unknown> = {},
  declared = NDA,
): Answer => ({
  reply,
  document: declared.slug,
  documentSpec: declared,
  fields,
});

/** An answer that has not settled on anything yet. */
export const undecided = (reply: string): Answer => ({
  reply,
  document: null,
  documentSpec: null,
  fields: {},
});

/**
 * Answers the chat routes from the test rather than from the model. The suite
 * runs against the real container, and a real model call would be slow, cost
 * money and say something different every run. What the model actually does
 * with a message is covered by the backend's live tests instead.
 */
export const stubChat = async (page: Page, answers: Answer[]) => {
  await page.route("**/api/chat/greeting", (route) =>
    route.fulfill({ json: { reply: GREETING } }),
  );

  let asked = 0;
  await page.route("**/api/chat/message", (route) => {
    const answer = answers[Math.min(asked, answers.length - 1)];
    asked += 1;
    return route.fulfill({ json: answer });
  });
};

/** Answers every message with a failure, to exercise the error path. */
export const stubChatFailure = async (page: Page) => {
  await page.route("**/api/chat/greeting", (route) =>
    route.fulfill({ json: { reply: GREETING } }),
  );
  await page.route("**/api/chat/message", (route) =>
    route.fulfill({ status: 502, json: { detail: "The AI answered with nothing" } }),
  );
};

/** Says something to the assistant and waits for the answer to land. */
export const say = async (page: Page, message: string) => {
  await page.getByLabel("Your message").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
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
