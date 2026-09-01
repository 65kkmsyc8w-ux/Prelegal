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
  draftId?: number | null;
}

/** An answer that is drafting the given document, saved as draft 1. */
export const drafting = (
  reply: string,
  fields: Record<string, unknown> = {},
  declared = NDA,
): Answer => ({
  reply,
  document: declared.slug,
  documentSpec: declared,
  fields,
  draftId: 1,
});

/** An answer that has not settled on anything yet, and so saved nothing. */
export const undecided = (reply: string): Answer => ({
  reply,
  document: null,
  documentSpec: null,
  fields: {},
  draftId: null,
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

export interface SavedDraft {
  id: number;
  document: string;
  title: string;
  updatedAt: string;
  documentSpec?: unknown;
  fields?: Record<string, unknown>;
  transcript?: { role: "user" | "assistant"; content: string }[];
}

/**
 * Answers the library from the test. The chat is stubbed, so the real backend
 * never saw the turns these drafts would have come from and has nothing to
 * list.
 */
export const stubDrafts = async (page: Page, drafts: SavedDraft[]) => {
  await page.route("**/api/drafts", (route) =>
    route.fulfill({
      json: drafts.map(({ id, document, title, updatedAt }) => ({
        id,
        document,
        title,
        updatedAt,
      })),
    }),
  );

  await page.route(/\/api\/drafts\/\d+$/, (route) => {
    const wanted = Number(new URL(route.request().url()).pathname.split("/").pop());
    const draft = drafts.find((candidate) => candidate.id === wanted);
    return draft
      ? route.fulfill({ json: draft })
      : route.fulfill({ status: 404, json: { detail: "No such draft" } });
  });
};

/** A saved Mutual NDA, mid conversation. */
export const A_SAVED_DRAFT: SavedDraft = {
  id: 1,
  document: NDA.slug,
  title: NDA.title,
  updatedAt: "2026-09-01T10:00:00",
  documentSpec: NDA,
  fields: A_DRAFT,
  transcript: [
    { role: "user", content: "An NDA between Acme Inc and Beta Ltd." },
    { role: "assistant", content: "That is everything." },
  ],
};

/** Says something to the assistant and waits for the answer to land. */
export const say = async (page: Page, message: string) => {
  await page.getByLabel("Your message").fill(message);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
};

export interface Account {
  email: string;
  displayName: string;
  password: string;
}

/**
 * A fresh account. Email is what identity means now, so every run needs its own
 * or the second would be refused as already registered: the suite runs three
 * engines in parallel against one container, and the container is not
 * necessarily restarted between runs.
 */
export const account = (label = "e2e"): Account => ({
  email: `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
  displayName: label,
  password: "opensesame",
});

/** Registers and lands on the platform. Signing up signs you in. */
export const signUp = async (page: Page, label = "e2e"): Promise<Account> => {
  const who = account(label);
  await page.goto("/signup/");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Your name").fill(who.displayName);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(`Signed in as ${who.displayName}`)).toBeVisible();
  return who;
};

/** Comes back to an account already registered. */
export const signIn = async (page: Page, who: Account) => {
  await page.goto("/login/");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`Signed in as ${who.displayName}`)).toBeVisible();
};
