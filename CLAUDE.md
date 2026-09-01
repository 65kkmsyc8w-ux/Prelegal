# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

All eleven agreements can be drafted through AI chat. Sign-in is a display name
and nothing else, and nothing is saved: real authentication and saved documents
are PL-8.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `nvidia/nemotron-3.5-lightning:free` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

Two facts about that pairing, established by calling the API rather than by
reading docs. OpenRouter serves this model from Nvidia whatever provider order
is asked for, so the Cerebras preference is sent and does not bind. And litellm
refuses the skill's `reasoning_effort` argument for this model, so the reasoning
setting travels in `extra_body` instead; without it the answer comes back empty.
`backend/AGENTS.md` records both, along with the empty-answer retry they made
necessary.

There is an OPENROUTER_API_KEY in the .env file in the project root, and the
backend now refuses to start without it. `.env.example` is the tracked copy to
start from; `.env` itself is never committed.

## Technical design

The entire project should be packaged into a Docker container.
The backend should be in backend/ and be a uv project, using FastAPI.
The frontend should be in frontend/
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.
Consider statically building the frontend and serving it via FastAPI, if that will work.
There should be scripts in scripts/ for:

```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

Backend available at http://localhost:4000

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

Two of these are deliberately not used, for contrast. White on Blue Primary is
3.06:1 and Gray Text on white is 3.5:1, both short of the 4.5:1 WCAG AA asks
for, so the agreement and the form keep the darker `--accent` (8.4:1) and
`--muted`. The palette carries the platform chrome, where Navy and Purple hold
up. The reasoning sits in `globals.css` beside the tokens.

## Implementation Status

Jira PL-2, PL-3, PL-5, PL-6 and PL-7 are done. PL-8 is not started, so there are
no saved documents and no real authentication.

### Completed (PL-2)

- `templates/` holds twelve Common Paper files covering eleven agreements,
  under CC BY 4.0. The Mutual NDA is a cover page plus standard terms.
- `catalog.json` names, describes and sources each one

### Completed (PL-3)

- Next.js static export building a Common Paper Mutual NDA from a form
- Live preview: the cover page and the Standard Terms build as the user types
- Download opens the browser print dialog; Save as PDF keeps a copy
- The Standard Terms were transcribed by hand into
  `frontend/src/content/standard-terms.ts`. PL-7 replaced that file with clauses
  generated from the template.

### Completed (PL-5)

- One Docker container: a `node:24-slim` stage runs `next build` with
  `output: "export"` and the resulting `out/` is copied into a `python:3.13-slim`
  image as `/app/static`. No Node at runtime.
- FastAPI serves the API under `/api` and the static export at `/`, published on
  host port 4000.
- SQLite, rebuilt from scratch on every container start. Nothing mounts a
  volume, so the file lives and dies inside the container.
- A fake login: `/login/` takes a display name and nothing else. There is no
  password and no authentication. Signing in under a name already used returns
  to that same account.
- Start and stop scripts for Mac, Linux and Windows.
- Product features were unchanged by this ticket. NDA drafting was still
  entirely client-side at this point; PL-6 moved it to the chat.

### Completed (PL-6)

- The form is gone. A freeform chat with an assistant gathers the cover page,
  and the agreement builds beside the conversation as it goes.
- LiteLLM through OpenRouter, with Structured Outputs: one call per turn returns
  the assistant's next message and whatever it took from the last one.
- `POST /api/chat/message` is stateless. The browser holds the transcript and
  the fields and sends both, so nothing is stored and nothing is lost but a
  reload.
- `merge_fields` lays what the assistant found over what was already known, so a
  turn that says nothing about a field leaves it standing.
- The container now needs `OPENROUTER_API_KEY` to start, and the start scripts
  pass `.env` in and refuse to build without it.

### Completed (PL-7)

- All eleven Common Paper agreements can be drafted, not just the Mutual NDA.
- The document type is settled by talking. Until one is, the assistant is at a
  front desk with the catalog in front of it; asked for something we cannot
  draft, it says so and offers the nearest thing we can.
- Each document is declared in `documents/<slug>.spec.json`. Only the Mutual NDA
  ships a cover page, here or upstream, so the other ten have their field lists
  derived from the values their own prose references.
- `documents/<slug>.clauses.json` and `frontend/src/content/generated/<slug>.ts`
  are generated from `templates/<slug>.md` by
  `frontend/scripts/generate-clauses.mjs` (`npm run generate`), and committed.
- One renderer serves all eleven, driven by the declaration the server sends.
- `catalog.json` is now read at runtime and copied into the image: it is where
  each document's description comes from, and so what the front desk offers.
  `templates/` is still read only by the generator and still never enters the
  image.

### Not built yet

- Real authentication and saved documents (PL-8).

### Current API endpoints

- `GET /api/health` - health check, used by the start scripts
- `GET /api/chat/greeting` - the assistant's opening line, no provider call
- `POST /api/chat/message` - one turn of the conversation, 502 if the model
  fails, 422 if `fields` are not the shape `document` takes. Carries `document`
  and `fields`; answers with the document settled on, its declaration, and the
  merged fields
- `POST /api/auth/session` - sign in under a display name, sets the session cookie
- `POST /api/auth/signout` - clear the session cookie
- `GET /api/auth/me` - the signed-in user, 401 when there is no session

## Invariants

Each of these has a regression test behind it, except the two marked below,
which are documented but not yet pinned.

- **`main.py` route order.** `StaticFiles` is mounted at `/` as a catch-all. Any
  route registered after the mount is unreachable.
- **`trailingSlash: true`** in `next.config.ts`, or the export writes `login.html`
  rather than `login/index.html` and `StaticFiles` 404s a direct visit to `/login/`.
- **Services flush, routers commit.** `domain/users.py` writes inside a
  savepoint rather than committing; the router owns the transaction. *No test
  pins this: nothing fails if a service starts committing.*
- **`core/db.py` `DATA_DIR` is `parents[2]`**, not `parent.parent`. The wrong
  offset puts the database inside the app package. *No test pins this, and the
  suites cannot catch it: they never run the lifespan, so nothing opens the real
  database file.*
- **A session cookie can outlive the account it names**, because the database is
  rebuilt on every start. `current_user` answers 401 for it.
- **`merge_fields` reads a missing value as "not mentioned", never as "clear
  it".** A turn that says nothing about a field leaves the value standing. An
  empty string counts as missing too: the model fills fields it knows nothing
  about with `""`, which would otherwise wipe an answer given turns earlier.
- **The browser is sent the document's declaration**, so it renders a cover page
  it was never taught the shape of. Nothing is mirrored by hand across the
  boundary any more, which is why the test that used to pin the NDA's field
  names is gone rather than generalised.
- **A slug the assistant invents names nothing**, and is read the same way as
  naming none, so a hallucinated document costs a turn rather than a 500.
- **Changing document mid-conversation empties the cover page**, because field
  keys belong to the document they were gathered for.
- **Fields are read before the provider is called.** A body that is not the
  shape the document takes is a 422, not a 500, and costs no call. A turn takes
  a minute or more and is charged for, so finding out afterwards wastes both.
- **The chat prompt names every clause of every document**, pinned by a test,
  because nothing reads `templates/*.md` at runtime. A second test re-runs the
  generator and fails if the committed output has drifted from the templates.
- **Frontend test contract.** The suites assert on accessible names, roles and
  text, never `data-testid`. Check before any restyle.

## Where the code lives

```
documents/      <slug>.spec.json by hand, <slug>.clauses.json generated
backend/app/    routers -> ai -> domain -> core, dependencies one way only
  core/         config, engine, session cookie, the auth dependency
  domain/       models, schemas, the user upsert, the field vocabulary,
                the document registry and the merge
  ai/           the provider client, the front desk and drafting prompts
  routers/      one module per resource, all mounted under /api
frontend/
  scripts/      generate-clauses.mjs, run by npm run generate
  src/app/      page.tsx (chat beside the document), login/, globals.css
  src/components/  AuthGate, ChatPanel, DocumentView
  src/lib/      api.ts (the one API client), documents.ts (the spec shape),
                fields.ts (how a field reads once filled)
  src/content/  clause.ts (the generated shape),
                generated/ (the terms, generated from templates/)
```

`frontend/AGENTS.md` is written by `next dev` itself, not by hand. It is real,
it is committed, and it gets re-created if deleted. Leave it alone.

## Running and testing it

Copy `.env.example` to `.env` and fill in `OPENROUTER_API_KEY` first: the
backend refuses to start without it.

```bash
./scripts/start-mac.sh                                    # http://localhost:4000
cd frontend && npm run generate                           # after any template or spec change
docker build --target test -t prelegal-test . && \
  docker run --rm -e OPENROUTER_API_KEY=stub prelegal-test   # backend, 80% gate
docker run --rm --env-file .env prelegal-test pytest -m live --no-cov
cd frontend && npm test && npm run lint && npm run test:e2e
```

The end to end suite drives the running container, not `next dev`, and answers
the chat routes from the test with `page.route`. `next dev` serves the frontend
with no API behind it, so the login screen, the session gate and the chat cannot
work there. **Rebuild the container after any frontend change**: it serves the
built export, not the source.

Run `npx next build` before trusting a frontend change. A CSS syntax error
passes both `tsc` and vitest and only fails there.

## Known caveats

- **The assistant is slow.** A turn takes 30 to 150 seconds on the free model; a
  measured round trip was 82 seconds. The UI has a live region and a waiting
  status because of it.
- **The provider sometimes answers with nothing**, with `finish_reason` "stop"
  rather than a truncation, so a larger token budget does not help. One retry
  does, and a second empty answer surfaces as a 502.
- **Nothing survives a reload.** The transcript and the draft live in the
  browser, and the database is rebuilt on every container start.
