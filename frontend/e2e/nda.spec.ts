import { expect, test } from "@playwright/test";

import { emptyNda } from "../src/lib/nda";
import { A_DRAFT, say, signIn, stubChat, stubChatFailure } from "./support";

const HALF_WAY = {
  ...emptyNda(),
  purpose: A_DRAFT.purpose,
  partyOne: A_DRAFT.partyOne,
  partyTwo: A_DRAFT.partyTwo,
};

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("builds the agreement as the conversation goes on", async ({ page }) => {
  await stubChat(page, [{ reply: "Which state's law?", fields: A_DRAFT }]);
  await page.goto("/");
  const agreement = page.getByRole("article");
  await expect(agreement).toContainText("[Governing Law]");

  await say(page, "An NDA between Acme Inc and Beta Ltd for a supply arrangement.");

  await expect(agreement).toContainText("Evaluating a supply arrangement.");
  await expect(agreement).toContainText("31 August 2026");
  await expect(agreement).toContainText("the laws of the State of Delaware");
  await expect(agreement).toContainText("courts located in New Castle, DE");
  await expect(agreement).not.toContainText("[");
});

test("keeps what was settled earlier when a later answer adds to it", async ({
  page,
}) => {
  await stubChat(page, [
    { reply: "Which state's law?", fields: HALF_WAY },
    { reply: "That is everything.", fields: A_DRAFT },
  ]);
  await page.goto("/");

  await say(page, "An NDA between Acme Inc and Beta Ltd for a supply arrangement.");
  await expect(page.getByRole("article")).toContainText("Acme Inc");

  await say(page, "Delaware law, and the courts in New Castle, DE.");

  await expect(page.getByRole("article")).toContainText("Acme Inc");
  await expect(page.getByRole("article")).toContainText("Delaware");
});

test("opens with the assistant asking the first question", async ({ page }) => {
  await stubChat(page, [{ reply: "Noted.", fields: emptyNda() }]);
  await page.goto("/");

  await expect(
    page.getByText("What is this agreement for, and who are the two parties?"),
  ).toBeVisible();
});

test("says so when the assistant cannot answer, keeping what was typed", async ({
  page,
}) => {
  await stubChatFailure(page);
  await page.goto("/");

  await page.getByLabel("Your message").fill("Delaware law");
  await page.getByRole("button", { name: "Send" }).click();

  // Scoped to the panel: Next renders its own empty role="alert" announcer.
  const chat = page.getByRole("region", { name: "Chat" });
  await expect(chat.getByRole("alert")).toContainText("The AI answered with nothing");
  await expect(page.getByLabel("Your message")).toHaveValue("Delaware law");
});

test("names the parties in the signature table", async ({ page }) => {
  await stubChat(page, [{ reply: "Noted.", fields: A_DRAFT }]);
  await page.goto("/");
  await say(page, "Acme Inc and Beta Ltd.");

  const table = page.getByRole("table");

  await expect(table.getByRole("columnheader", { name: "Acme Inc" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Beta Ltd" })).toBeVisible();
  await expect(table).toContainText("Ada Lovelace");
  await expect(table).toContainText("grace@beta.example");
});

test("carries the whole agreement, both halves", async ({ page }) => {
  await stubChat(page, [{ reply: "Noted.", fields: emptyNda() }]);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Cover Page" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Standard Terms" })).toBeVisible();
  await expect(page.getByRole("article").getByRole("listitem")).toHaveCount(11);
  await expect(page.getByRole("article")).toContainText("free to use under CC BY 4.0");
});

test("puts the conversation beside the agreement on a wide screen", async ({ page }) => {
  await stubChat(page, [{ reply: "Noted.", fields: emptyNda() }]);
  await page.goto("/");
  await page.setViewportSize({ width: 1440, height: 900 });

  const chat = page.locator(".chat-column");
  const agreement = page.locator(".document-column");
  const chatBox = (await chat.boundingBox())!;
  const agreementBox = (await agreement.boundingBox())!;

  expect(agreementBox.x).toBeGreaterThan(chatBox.x + chatBox.width - 1);
});

test("stacks the conversation above the agreement on a narrow screen", async ({
  page,
}) => {
  await stubChat(page, [{ reply: "Noted.", fields: emptyNda() }]);
  await page.goto("/");
  await page.setViewportSize({ width: 500, height: 900 });

  const chatBox = (await page.locator(".chat-column").boundingBox())!;
  const agreementBox = (await page.locator(".document-column").boundingBox())!;

  expect(agreementBox.y).toBeGreaterThan(chatBox.y + chatBox.height - 1);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 500);
});

test.describe("printing", () => {
  test.beforeEach(async ({ page }) => {
    await stubChat(page, [{ reply: "Noted.", fields: A_DRAFT }]);
    await page.goto("/");
    await say(page, "Everything, please.");
    await page.emulateMedia({ media: "print" });
  });

  test("prints the agreement without the conversation or the page chrome", async ({
    page,
  }) => {
    await expect(page.locator(".chat-column")).toBeHidden();
    await expect(page.locator(".document-toolbar")).toBeHidden();
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
  await stubChat(page, [{ reply: "Noted.", fields: emptyNda() }]);
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Download PDF" }).click();

  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
});

test("keeps the draft in the browser, with nothing carried across a reload", async ({
  page,
}) => {
  await stubChat(page, [{ reply: "Noted.", fields: A_DRAFT }]);
  await page.goto("/");
  await say(page, "Everything, please.");
  await expect(page.getByRole("article")).toContainText("Acme Inc");

  await page.reload();

  await expect(page.getByRole("article")).toContainText("[Purpose]");
  expect(A_DRAFT.partyOne.company).toBe("Acme Inc");
});
