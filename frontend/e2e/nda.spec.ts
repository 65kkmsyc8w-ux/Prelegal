import { expect, test } from "@playwright/test";

import { A_DRAFT, fillDraft, signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/");
});

test("builds the agreement as the user types", async ({ page }) => {
  const agreement = page.getByRole("article");
  await expect(agreement).toContainText("[Governing Law]");

  await fillDraft(page);

  await expect(agreement).toContainText("Evaluating a supply arrangement.");
  await expect(agreement).toContainText("31 August 2026");
  await expect(agreement).toContainText("the laws of the State of Delaware");
  await expect(agreement).toContainText("courts located in New Castle, DE");
  await expect(agreement).not.toContainText("[");
});

test("will not write a term of zero years into the agreement", async ({ page }) => {
  const years = page
    .getByRole("group", { name: "MNDA term" })
    .getByLabel("Years", { exact: true });
  await years.clear();

  await expect(page.getByRole("article")).toContainText(
    "Expires [Years] from the Effective Date.",
  );
  await expect(page.getByRole("article")).not.toContainText("0 years");
});

test("names the parties in the signature table", async ({ page }) => {
  await fillDraft(page);
  const table = page.getByRole("table");

  await expect(table.getByRole("columnheader", { name: "Acme Inc" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Beta Ltd" })).toBeVisible();
  await expect(table).toContainText("Ada Lovelace");
  await expect(table).toContainText("grace@beta.example");
});

test("carries the whole agreement, both halves", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Cover Page" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Standard Terms" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(11);
  await expect(page.getByRole("article")).toContainText("free to use under CC BY 4.0");
});

test("puts the form beside the agreement on a wide screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const form = page.locator(".form-column");
  const agreement = page.locator(".document-column");
  const formBox = (await form.boundingBox())!;
  const agreementBox = (await agreement.boundingBox())!;

  expect(agreementBox.x).toBeGreaterThan(formBox.x + formBox.width - 1);
});

test("stacks the form above the agreement on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 900 });

  const formBox = (await page.locator(".form-column").boundingBox())!;
  const agreementBox = (await page.locator(".document-column").boundingBox())!;

  expect(agreementBox.y).toBeGreaterThan(formBox.y + formBox.height - 1);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 500);
});

test.describe("printing", () => {
  test.beforeEach(async ({ page }) => {
    await fillDraft(page);
    await page.emulateMedia({ media: "print" });
  });

  test("prints the agreement without the form or the page chrome", async ({ page }) => {
    await expect(page.locator(".form-column")).toBeHidden();
    await expect(page.locator(".masthead")).toBeHidden();
    await expect(page.locator(".session-bar")).toBeHidden();
    await expect(page.getByRole("article")).toBeVisible();
  });

  test("prints every clause and the signature table", async ({ page }) => {
    const agreement = page.getByRole("article");
    // The clause numbers are the ordered list's markers, not text of their own.
    await expect(agreement.getByRole("list")).toHaveCount(1);
    await expect(agreement.getByRole("listitem")).toHaveCount(11);
    await expect(agreement).toContainText("Introduction.");
    await expect(agreement).toContainText("the laws of the State of Delaware");
    await expect(agreement).toContainText("Ada Lovelace");
    await expect(agreement).toContainText("free to use under CC BY 4.0");
  });

  test("writes a PDF holding the whole agreement", async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== "chromium", "page.pdf is Chromium only");

    const pdf = await page.pdf({ format: "A4" });
    await testInfo.attach("mutual-nda.pdf", {
      body: pdf,
      contentType: "application/pdf",
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });
});

test("the download button asks the browser to print", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await page.reload();

  await page.getByRole("button", { name: "Download PDF" }).click();

  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
});

test("keeps the draft in the browser, with nothing carried across a reload", async ({
  page,
}) => {
  await fillDraft(page);
  await expect(page.getByRole("article")).toContainText("Acme Inc");

  await page.reload();

  await expect(page.getByRole("article")).toContainText("[Purpose]");
  expect(A_DRAFT.partyOne.company).toBe("Acme Inc");
});
