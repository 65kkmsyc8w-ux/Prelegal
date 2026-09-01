import { expect, test } from "@playwright/test";

import {
  A_SAVED_DRAFT,
  drafting,
  say,
  signUp,
  stubChat,
  stubDrafts,
} from "./support";

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("has nothing to look back at before anything is drafted", async ({ page }) => {
  await page.goto("/drafts/");

  await expect(page.getByText("You have not started an agreement yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start one" })).toBeVisible();
});

test("names every agreement that has been started", async ({ page }) => {
  await stubDrafts(page, [
    A_SAVED_DRAFT,
    { ...A_SAVED_DRAFT, id: 2, title: "Pilot Agreement" },
  ]);
  await page.goto("/drafts/");

  await expect(
    page.getByRole("link", { name: "Mutual Non-Disclosure Agreement" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Pilot Agreement" })).toBeVisible();
  await expect(page.getByText("Last worked on 1 September 2026").first()).toBeVisible();
});

test("opens a saved draft with its conversation and its agreement", async ({
  page,
}) => {
  await stubChat(page, [drafting("Noted.")]);
  await stubDrafts(page, [A_SAVED_DRAFT]);
  await page.goto("/drafts/");

  await page.getByRole("link", { name: "Mutual Non-Disclosure Agreement" }).click();

  await expect(page).toHaveURL(/\?draft=1$/);
  await expect(page.getByText("An NDA between Acme Inc and Beta Ltd.")).toBeVisible();
  await expect(page.getByText("That is everything.")).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Evaluating a supply");
});

test("carries on the conversation a saved draft was left in", async ({ page }) => {
  await stubChat(page, [drafting("Delaware it is.")]);
  await stubDrafts(page, [A_SAVED_DRAFT]);
  await page.goto("/?draft=1");
  await expect(page.getByText("That is everything.")).toBeVisible();

  await say(page, "Make it Delaware law.");

  await expect(page.getByText("Delaware it is.")).toBeVisible();
  // The thread it was reopened with is still above the new exchange.
  await expect(page.getByText("An NDA between Acme Inc and Beta Ltd.")).toBeVisible();
});

test("says so when a draft cannot be opened", async ({ page }) => {
  await stubDrafts(page, []);

  await page.goto("/?draft=999");

  // Scoped: Next renders an empty role="alert" announcer of its own.
  await expect(page.locator(".notice").getByRole("alert")).toContainText(
    "could not be opened",
  );
  await expect(page.getByRole("link", { name: "Back to my drafts" })).toBeVisible();
});

test("starts a fresh conversation from the header, whatever is open", async ({
  page,
}) => {
  await stubChat(page, [drafting("Noted.")]);
  await stubDrafts(page, [A_SAVED_DRAFT]);
  await page.goto("/?draft=1");
  await expect(page.getByRole("article")).toBeVisible();

  await page.getByRole("link", { name: "New document" }).click();

  await expect(page.getByText("What kind of agreement do you need?")).toBeVisible();
  await expect(page.getByRole("article")).toBeHidden();
});

test("keeps one account's drafts out of another's", async ({ page }) => {
  // The library is answered by the real backend here, not the stub, so this is
  // the server's own ownership rule being exercised.
  await page.goto("/drafts/");
  await expect(page.getByText("You have not started an agreement yet.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  // Signing out redirects. Navigating before it lands aborts it in Firefox.
  await expect(page).toHaveURL(/\/login\/$/);
  await signUp(page, "second");
  await page.goto("/drafts/");

  await expect(page.getByText("You have not started an agreement yet.")).toBeVisible();
});
