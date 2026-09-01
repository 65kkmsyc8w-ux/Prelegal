# Manual tests

What the automated suites cannot reach. `npm test` and `npm run test:e2e` cover
the fill logic, the components, the page, and the print stylesheet under
emulated print media in Chromium, Firefox and WebKit, plus a headless PDF in
Chromium. Everything below needs a real print dialog, real paper or a human
eye.

Start the container with `./scripts/start-mac.sh` and work through the list at
http://localhost:4000. `next dev` will not do: it serves the frontend with no
API behind it, so signing in and the assistant both fail there. Record the
browser and version against each run.

## The download

The E2E suite emulates print media and generates a PDF through the automation
API. Neither goes through the browser's own print dialog, which is what a user
actually gets, and neither says anything about the margins the dialog applies.

1. Talk the assistant through an agreement until nothing is left in square
   brackets. Press Download PDF.
2. The browser print dialog opens. The preview shows the agreement alone: no
   conversation, no page header, no Download button. The disclaimer that this
   is a draft is on the agreement and so is in the preview.
3. Set the destination to Save as PDF and save. Open the saved file.
4. The cover page values are the ones typed. Clause 9 names the governing law
   and the jurisdiction. All 11 clauses are present. The attribution line
   survives on the last page.
5. Page breaks fall between clauses, not through the middle of one. The
   signature table is not split across two pages.
6. Repeat with the browser's default margins, then with margins set to None.
   Nothing is clipped at either setting.

Do this in Chrome, Firefox and Safari. The E2E suite now checks the print
stylesheet on all three engines, so what remains here is the dialog itself and
the pagination of the file it writes, which only a real print pipeline decides.

## Printing to paper

7. Print to a physical printer. Confirm the text is legible at its printed size
   and that nothing relies on colour to be readable in greyscale.

## Content that stretches the layout

The assistant writes these values, so ask for them rather than typing them in.

8. Give a purpose of several hundred words. It should wrap in the document and
   push the layout down, not overflow its column or clip.
9. Give a company name of 60 characters. The signature table should stay within
   the page width in both the screen and print views.
10. Give a multi-line postal address as the notice address. Confirm how it
    renders; the assistant reports it as one string, so it arrives as one line.
11. Give a purpose containing an ampersand, angle brackets and a quotation mark.
    They should appear literally in the document.

## Accounts

12. Sign up. You land on the platform signed in, with no second step.
13. Sign out and sign back in with the same email and password.
14. Try to sign up again under an email already used. It is refused and says so,
    and you stay on the sign up screen.
15. Tab through both auth screens from the top. Focus order follows the visual
    order and every control shows a visible focus ring. Complete a sign up using
    only the keyboard.

## Saved drafts

16. Talk an agreement part way through, then reload. The conversation and the
    cover page come back as they were.
17. Open My drafts. The agreement is listed by name with the date it was last
    worked on. Open it and carry on talking; the new exchange joins the old.
18. Choose New document while a draft is open. The conversation starts over and
    the agreement leaves the screen.
19. Sign out, sign up as somebody else, open My drafts. It is empty: no draft of
    the first account is visible.
20. Stop and restart the container. Both the account and its drafts are gone.
    This is intended: the database is rebuilt on every start and nothing mounts
    a volume.

## Screen sizes and zoom

21. Narrow the window slowly from wide to 400px. The two columns become one at
    around 960px, the header wraps rather than overflowing, and no horizontal
    scrollbar ever appears.
22. At 200% browser zoom, every screen remains usable and no text is cut off.
23. On a phone, confirm the document is readable and the Download button is
    reachable without horizontal scrolling.

## Screen readers

24. With VoiceOver or NVDA, confirm each input is announced with its label, that
    the signature table's row and column headers are announced when moving
    between cells, that the disclaimer is reachable, and that a reply from the
    assistant is announced when it arrives.
