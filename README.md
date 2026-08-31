# Prelegal

A platform for drafting common legal agreements.

## Status

**In progress.** The project is under active development and is targeted for
completion by **7 September 2026**.

The Mutual NDA creator is the first drafting tool to land. Tracking issue:
[#1](https://github.com/65kkmsyc8w-ux/Prelegal/issues/1).

## Mutual NDA creator

`frontend/` holds a Next.js app that builds a Common Paper Mutual NDA. Fill in
the cover page and the agreement, cover page and Standard Terms together,
renders alongside the form. Download opens the browser print dialog; choose
Save as PDF to keep a copy.

It is a static site: there is no server and nothing is stored or sent anywhere.

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests
npm run lint
npm run build   # static export into frontend/out
```

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
