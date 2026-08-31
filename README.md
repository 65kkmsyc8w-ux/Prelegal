# Prelegal

A platform for drafting common legal agreements.

## Status

**In progress.** The project is under active development and is targeted for
completion by **7 September 2026**.

The Mutual NDA creator is the first drafting tool to land. Tracking issue:
[#1](https://github.com/65kkmsyc8w-ux/Prelegal/issues/1).

## Mutual NDA creator

`frontend/` holds a Next.js app that builds a Common Paper Mutual NDA. Fill in
the cover page and the agreement builds as you type, the cover page and the
Standard Terms together, alongside the form. Anything left blank shows as a
placeholder in square brackets. Download opens the browser print dialog; choose
Save as PDF to keep a copy.

It is a static site: there is no server and nothing is stored or sent anywhere.

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # static export into frontend/out
npm run lint
```

## Tests

```bash
cd frontend
npm test           # unit and component tests
npm run test:e2e   # end to end, starts its own dev server
```

`npm run test:e2e` needs the browser once: `npx playwright install chromium`.

[docs/manual-tests.md](docs/manual-tests.md) lists what the suites cannot
reach, chiefly the browser's own print dialog and the saved PDF.

## Templates

`templates/` holds the Common Paper standard agreements the system drafts from,
under CC BY 4.0; see [templates/LICENSE.txt](templates/LICENSE.txt).
[catalog.json](catalog.json) lists the name, description, filename and source
repository of each one.

The Mutual NDA Standard Terms are transcribed into
`frontend/src/content/standard-terms.ts` so the app can render them; the
markdown in `templates/` remains the source of truth.

## Licence

See [LICENSE](LICENSE).
