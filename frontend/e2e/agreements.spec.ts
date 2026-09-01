import { expect, test } from "@playwright/test";

import {
  A_DRAFT,
  A_SAVED_DRAFT,
  drafting,
  say,
  signUp,
  spec,
  stubChat,
  stubChatFailure,
  stubDrafts,
  undecided,
} from "./support";

const HALF_WAY = {
  purpose: A_DRAFT.purpose,
  partyOne: A_DRAFT.partyOne,
  partyTwo: A_DRAFT.partyTwo,
};

const PILOT = spec("pilot-agreement");

test.beforeEach(async ({ page }) => {
  await signUp(page);
});

test("opens on the conversation, with no agreement chosen yet", async ({ page }) => {
  await stubChat(page, [drafting("Noted.")]);
  await page.goto("/");

  await expect(page.getByText("What kind of agreement do you need?")).toBeVisible();
  await expect(page.getByRole("article")).toBeHidden();
});

test("builds the agreement as the conversation goes on", async ({ page }) => {
  await stubChat(page, [
    drafting("A Mutual NDA then. Which state's law?", {}),
    drafting("That is everything.", A_DRAFT),
  ]);
  await page.goto("/");

  await say(page, "An NDA between Acme Inc and Beta Ltd for a supply arrangement.");
  const agreement = page.getByRole("article");
  await expect(agreement).toContainText("[Governing Law]");

  await say(page, "Delaware law, and the courts in New Castle, DE.");

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
    drafting("Which state's law?", HALF_WAY),
    drafting("That is everything.", A_DRAFT),
  ]);
  await page.goto("/");

  await say(page, "An NDA between Acme Inc and Beta Ltd for a supply arrangement.");
  await expect(page.getByRole("article")).toContainText("Acme Inc");

  await say(page, "Delaware law, and the courts in New Castle, DE.");

  await expect(page.getByRole("article")).toContainText("Acme Inc");
  await expect(page.getByRole("article")).toContainText("Delaware");
});

test("says what it cannot draft and offers the nearest thing it can", async ({
  page,
}) => {
  await stubChat(page, [
    undecided(
      "We cannot draft an employment contract. The closest we can is a Professional Services Agreement.",
    ),
  ]);
  await page.goto("/");

  await say(page, "I need an employment contract.");

  await expect(page.getByText(/cannot draft an employment contract/)).toBeVisible();
  await expect(page.getByRole("article")).toBeHidden();
});

test("drafts an agreement other than the NDA", async ({ page }) => {
  await stubChat(page, [
    drafting("A Pilot Agreement then.", { governingLaw: "Delaware" }, PILOT),
  ]);
  await page.goto("/");

  await say(page, "We want a customer to trial our product for 60 days.");

  const agreement = page.getByRole("article");
  await expect(
    page.getByRole("heading", { level: 1, name: "Pilot Agreement" }),
  ).toBeVisible();
  await expect(agreement).toContainText("Delaware");
  // Its terms are written in subclauses, unlike the NDA's single paragraphs.
  await expect(agreement.locator(".subclauses li").first()).toBeVisible();
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
  await stubChat(page, [drafting("Noted.", A_DRAFT)]);
  await page.goto("/");
  await say(page, "Acme Inc and Beta Ltd.");

  const table = page.getByRole("table");

  await expect(table.getByRole("columnheader", { name: "Acme Inc" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Beta Ltd" })).toBeVisible();
  await expect(table).toContainText("Ada Lovelace");
  await expect(table).toContainText("grace@beta.example");
});

test("carries the whole agreement, both halves", async ({ page }) => {
  await stubChat(page, [drafting("Noted.")]);
  await page.goto("/");
  await say(page, "An NDA please.");

  await expect(page.getByRole("heading", { name: "Cover Page" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Standard Terms" })).toBeVisible();
  await expect(page.getByRole("article").getByRole("listitem")).toHaveCount(11);
  await expect(page.getByRole("article")).toContainText("free to use under CC BY 4.0");
});

test("puts the conversation beside the agreement on a wide screen", async ({ page }) => {
  await stubChat(page, [drafting("Noted.")]);
  await page.goto("/");
  await say(page, "An NDA please.");
  await page.setViewportSize({ width: 1440, height: 900 });

  const chatBox = (await page.locator(".chat-column").boundingBox())!;
  const agreementBox = (await page.locator(".document-column").boundingBox())!;

  expect(agreementBox.x).toBeGreaterThan(chatBox.x + chatBox.width - 1);
});

test("stacks the conversation above the agreement on a narrow screen", async ({
  page,
}) => {
  await stubChat(page, [drafting("Noted.")]);
  await page.goto("/");
  await say(page, "An NDA please.");
  await page.setViewportSize({ width: 500, height: 900 });

  const chatBox = (await page.locator(".chat-column").boundingBox())!;
  const agreementBox = (await page.locator(".document-column").boundingBox())!;

  expect(agreementBox.y).toBeGreaterThan(chatBox.y + chatBox.height - 1);
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 500);
});

test.describe("printing", () => {
  test.beforeEach(async ({ page }) => {
    await stubChat(page, [drafting("Noted.", A_DRAFT)]);
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
    await expect(page.locator(".app-bar")).toBeHidden();
    await expect(page.locator(".disclaimer-banner")).toBeHidden();
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

  test("prints the warning that it is a draft", async ({ page }) => {
    // The PDF is the copy that leaves the building, so it is the one that most
    // needs to say no lawyer has read it.
    await expect(page.getByRole("article")).toContainText(
      "no lawyer has reviewed it",
    );
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
  await stubChat(page, [drafting("Noted.")]);
  await page.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await page.goto("/");
  await say(page, "An NDA please.");

  await page.getByRole("button", { name: "Download PDF" }).click();

  expect(
    await page.evaluate(() => (window as unknown as { printed: number }).printed),
  ).toBe(1);
});

test("comes back to the draft after a reload", async ({ page }) => {
  await stubChat(page, [drafting("Noted.", A_DRAFT)]);
  await stubDrafts(page, [A_SAVED_DRAFT]);
  await page.goto("/");
  await say(page, "Everything, please.");
  await expect(page.getByRole("article")).toContainText("Acme Inc");
  // The first saved turn puts the draft in the address, which is what a reload
  // has to go on.
  await expect(page).toHaveURL(/\?draft=1$/);

  await page.reload();

  await expect(page.getByRole("article")).toContainText("Acme Inc");
  await expect(page.getByText("That is everything.")).toBeVisible();
});

test("starts empty when nothing has been settled on to save", async ({ page }) => {
  await stubChat(page, [undecided("Which of these did you mean?")]);
  await page.goto("/");
  await say(page, "Something legal.");

  await page.reload();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("article")).toBeHidden();
  await expect(page.getByText(/settled on which agreement/)).toBeVisible();
});
