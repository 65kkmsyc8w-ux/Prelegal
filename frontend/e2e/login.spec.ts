import { expect, test, type Page } from "@playwright/test";

import { account, signIn, signUp } from "./support";

// Next renders an empty role="alert" of its own to announce route changes, so
// every assertion here is scoped to the card the message actually appears in.
const refusal = (page: Page) => page.locator(".login-card").getByRole("alert");

test("sends a visitor who has not signed in to the login screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\/$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("asks for an email and a password", async ({ page }) => {
  await page.goto("/login/");

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("offers a way to register to someone with no account", async ({ page }) => {
  await page.goto("/login/");

  await page.getByRole("link", { name: "Create an account" }).click();

  await expect(page).toHaveURL(/\/signup\/$/);
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("opens the platform once an account is registered", async ({ page }) => {
  await signUp(page, "arrival");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Agreement drafter" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
});

test("refuses a second account under one email", async ({ page }) => {
  const taken = await signUp(page, "twice");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await page.goto("/signup/");
  await page.getByLabel("Email").fill(taken.email);
  await page.getByLabel("Your name").fill("Someone else");
  await page.getByLabel("Password").fill("anotherpassword");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(refusal(page)).toContainText("already uses that email");
  await expect(page).toHaveURL(/\/signup\/$/);
});

test("keeps the session across a reload", async ({ page }) => {
  const who = await signUp(page, "returning");

  await page.reload();

  await expect(page.getByText(`Signed in as ${who.displayName}`)).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
});

test("closes the platform again on sign out", async ({ page }) => {
  await signUp(page, "leaving");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login\/$/);
});

test("returns to the same account on the right password", async ({ page }) => {
  const who = await signUp(page, "repeat");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await signIn(page, who);

  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
});

const signInBadly = async (page: Page, email: string) => {
  await page.goto("/login/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(refusal(page)).toBeVisible();
};

test("refuses the wrong password without saying whether the account exists", async ({
  page,
}) => {
  const who = await signUp(page, "wrong");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await signInBadly(page, who.email);
  const forRegistered = await refusal(page).textContent();

  await signInBadly(page, account("nobody").email);

  await expect(refusal(page)).toHaveText(forRegistered!);
});
