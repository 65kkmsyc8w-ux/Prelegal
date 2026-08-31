# Manual tests

What the automated suites cannot reach. `npm test` and `npm run test:e2e` cover
the fill logic, the components, the page, and the print stylesheet under
emulated print media in Chromium, Firefox and WebKit, plus a headless PDF in
Chromium. Everything below needs a real print dialog, real paper or a human
eye.

Run `npm run dev` in `frontend/` and work through the list. Record the browser
and version against each run.

## The download

The E2E suite emulates print media and generates a PDF through the automation
API. Neither goes through the browser's own print dialog, which is what a user
actually gets, and neither says anything about the margins the dialog applies.

1. Fill the form completely. Press Download PDF.
2. The browser print dialog opens. The preview shows the agreement alone: no
   form, no page heading, no Download button.
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

8. Enter a purpose of several hundred words. It should wrap in the document and
   push the layout down, not overflow its column or clip.
9. Enter a company name of 60 characters. The signature table should stay
   within the page width in both the screen and print views.
10. Enter a multi-line postal address in Notice address. Confirm how it renders;
    the field is a single-line input, so a postal address arrives as one line.
11. Enter a purpose containing an ampersand, angle brackets and a quotation
    mark. They should appear literally in the document.

## The form

12. Clear the Years field rather than replacing it. The document currently reads
    "Expires 0 years from the Effective Date" until a number is typed. Confirm
    this is acceptable for a prototype, or raise it.
13. Switch MNDA Term to "Continues until terminated" and back. The Years field
    disappears and returns holding its previous value.
14. Tab through the whole form from the top. Focus order follows the visual
    order and every control shows a visible focus ring.
15. Complete the entire form using only the keyboard, including both radio
    groups, and press Download.

## Screen sizes and zoom

16. Narrow the window slowly from wide to 400px. The two columns become one at
    around 960px and no horizontal scrollbar ever appears.
17. At 200% browser zoom, the form remains usable and no text is cut off.
18. On a phone, confirm the document is readable and the Download button is
    reachable without horizontal scrolling.

## Screen readers

19. With VoiceOver or NVDA, confirm each fieldset is announced with its legend,
    each input with its label, and that the signature table's row and column
    headers are announced when moving between cells.

## State

20. Fill the form, reload the page. Everything resets: the draft is deliberately
    not persisted. Confirm this is the intended behaviour for the prototype and
    that nothing suggests to the user that their work was saved.
