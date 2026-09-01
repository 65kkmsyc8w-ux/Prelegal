import { expect, test } from "@playwright/test";

import { signIn } from "./support";

test("sends a visitor who has not signed in to the login screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login\/$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("asks for a name and no password", async ({ page }) => {
  await page.goto("/login/");

  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveCount(0);
});

test("opens the platform once a name is given", async ({ page }) => {
  await signIn(page, "e2e-arrival");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Agreement drafter" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
});

test("keeps the session across a reload", async ({ page }) => {
  await signIn(page, "e2e-returning");

  await page.reload();

  await expect(page.getByText("Signed in as e2e-returning")).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
});

test("closes the platform again on sign out", async ({ page }) => {
  await signIn(page, "e2e-leaving");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login\/$/);
});

test("returns to the same account when the same name signs in again", async ({
  page,
}) => {
  await signIn(page, "e2e-repeat");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);

  await signIn(page, "e2e-repeat");

  await expect(page.getByRole("region", { name: "Chat" })).toBeVisible();
});
