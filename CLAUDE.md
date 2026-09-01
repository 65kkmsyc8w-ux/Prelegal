# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The Mutual NDA is the one document type built so far, drafted through AI chat.
Sign-in is a display name and nothing else, and nothing is saved: the other ten
types are PL-7, real authentication and saved documents are PL-8.

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

Jira PL-2, PL-3, PL-5 and PL-6 are merged to `main`. PL-7 and PL-8 are not
started, so there is still only one document type, no saved documents and no
real authentication.

### Completed (PL-2)

- `templates/` holds twelve Common Paper files covering eleven agreements,
  under CC BY 4.0. The Mutual NDA is a cover page plus standard terms.
- `catalog.json` names, describes and sources each one

### Completed (PL-3)

- Next.js static export building a Common Paper Mutual NDA from a form
- Live preview: the cover page and the Standard Terms build as the user types
- Download opens the browser print dialog; Save as PDF keeps a copy
- The Standard Terms are transcribed into `frontend/src/content/standard-terms.ts`

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
- Product features are unchanged. NDA drafting is still entirely client-side.

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

### Not built yet

- The other ten document types (PL-7), real authentication and saved documents
  (PL-8).

### Current API endpoints

- `GET /api/health` - health check, used by the start scripts
- `GET /api/chat/greeting` - the assistant's opening line, no provider call
- `POST /api/chat/message` - one turn of the conversation, 502 if the model fails
- `POST /api/auth/session` - sign in under a display name, sets the session cookie
- `POST /api/auth/signout` - clear the session cookie
- `GET /api/auth/me` - the signed-in user, 401 when there is no session

## Invariants

Each of these has a regression test behind it.

- **`main.py` route order.** `StaticFiles` is mounted at `/` as a catch-all. Any
  route registered after the mount is unreachable.
- **`trailingSlash: true`** in `next.config.ts`, or the export writes `login.html`
  rather than `login/index.html` and `StaticFiles` 404s a direct visit to `/login/`.
- **Services flush, routers commit.** `domain/users.py` mutates and flushes; the
  router owns the transaction.
- **`core/db.py` `DATA_DIR` is `parents[2]`**, not `parent.parent`. The wrong
  offset puts the database inside the app package.
- **A session cookie can outlive the account it names**, because the database is
  rebuilt on every start. `current_user` answers 401 for it.
- **`merge_fields` reads a missing value as "not mentioned", never as "clear
  it".** A turn that says nothing about a field leaves the value standing. An
  empty string counts as missing too: the model fills fields it knows nothing
  about with `""`, which would otherwise wipe an answer given turns earlier.
- **The cover page field names are pinned by a test.** `domain/nda.py` mirrors
  `frontend/src/lib/nda.ts` by hand and the two are only ever sent to each
  other, so renaming one side has to fail rather than drift.
- **The chat prompt names all eleven clauses**, pinned by a test, because
  nothing reads `templates/mutual-nda.md` at runtime.
- **Frontend test contract.** The suites assert on accessible names, roles and
  text, never `data-testid`. Check before any restyle.

## Where the code lives

```
backend/app/    routers -> ai -> domain -> core, dependencies one way only
  core/         config, engine, session cookie, the auth dependency
  domain/       models, schemas, the user upsert, the NDA shape and its merge
  ai/           the provider client and the chat prompt
  routers/      one module per resource, all mounted under /api
frontend/src/
  app/          page.tsx (chat beside the document), login/, globals.css
  components/   AuthGate, ChatPanel, NdaDocument
  lib/          api.ts (the one API client), nda.ts (the shape), fill.ts
  content/      standard-terms.ts, the eleven clauses transcribed by hand
```

`frontend/AGENTS.md` is written by `next dev` itself, not by hand. It is real,
it is committed, and it gets re-created if deleted. Leave it alone.

## Running and testing it

Copy `.env.example` to `.env` and fill in `OPENROUTER_API_KEY` first: the
backend refuses to start without it.

```bash
./scripts/start-mac.sh                                    # http://localhost:4000
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
