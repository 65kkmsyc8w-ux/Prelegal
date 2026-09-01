# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

All eleven agreements can be drafted through AI chat. Accounts are an email and
a password, and every conversation that settles on an agreement is saved and can
be reopened later.

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

Jira PL-2, PL-3, PL-5, PL-6, PL-7 and PL-8 are done. The V1 build is complete.

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

### Completed (PL-8)

- Accounts are real. Sign up takes an email, a display name and a password and
  signs you straight in; sign in takes the email and password. Email is the
  unique key, so a display name is ordinary text and two people may share one.
- Passwords are hashed with `hashlib.scrypt` from the standard library, at
  Django's `ScryptPasswordHasher` cost parameters, salted per password. No new
  dependency and no compiled wheel, which is what the six-package backend and
  the "never over-engineer" rule both ask for.
- Sign in answers the same 401 whether the email is unregistered or the password
  is wrong, so the route cannot be used to find out who has an account. A
  sign-up race loses with a 409 rather than being handed the winner's account.
- Every turn that settles on an agreement is saved to a `drafts` row carrying
  the document, the fields and the whole transcript. `My drafts` lists them and
  opening one restores both the conversation and the cover page, so the draft
  can be carried on rather than only read.
- The chat is no longer stateless, and the transaction discipline that kept it
  safe is now explicit: see the invariant below.
- A SaaS shell around every screen: a navy header with the wordmark, primary
  navigation and the signed-in account, a card based library, and restyled sign
  in and sign up screens.
- A disclaimer that the document is a draft and wants legal review, said once in
  `lib/disclaimer.ts` and rendered twice: a banner in the chrome, and a
  paragraph inside the agreement so it reaches the printed PDF.

### Current API endpoints

- `GET /api/health` - health check, used by the start scripts
- `GET /api/chat/greeting` - the assistant's opening line, no provider call
- `POST /api/chat/message` - one turn of the conversation, 502 if the model
  fails, 422 if `fields` are not the shape `document` takes, 404 if `draftId`
  names no draft the caller owns. Carries `document`, `fields` and `draftId`;
  answers with the document settled on, its declaration, the merged fields and
  the draft the turn was saved into
- `POST /api/auth/signup` - open an account with an email, a display name and a
  password. 201 and the session cookie, or 409 if the email is taken
- `POST /api/auth/session` - sign in with the email and password, sets the
  session cookie. 401 for a wrong password and for an unregistered email alike
- `POST /api/auth/signout` - clear the session cookie
- `GET /api/auth/me` - the signed-in user, 401 when there is no session
- `GET /api/drafts` - the caller's library, most recently worked on first, each
  card naming its agreement
- `GET /api/drafts/{id}` - one draft with its declaration, fields and
  transcript. 404 for a draft that does not exist and for one belonging to
  someone else alike

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
- **No transaction is open across the OpenRouter call.** Resolving the caller
  and checking the draft both read, and a SELECT alone opens a transaction that
  holds SQLite's shared lock. A turn takes 30 to 150 seconds, so `routers/chat.py`
  commits after those checks and before the provider is asked; without it every
  other request wanting to commit waits out the busy timeout and fails.
- **Sign in cannot be used to find out who has an account.** A wrong password
  and an unregistered email answer with the same 401 and the same message. The
  loser of a sign-up race is told the email is taken rather than handed the
  winner's account, which would sign it in with somebody else's password.
- **A password is stored and compared exactly as typed.** The email is trimmed
  and lower cased because a stray space is the same account; the password is
  neither, because trimming on the way in and not on the way back would lock out
  anyone whose password ends in a space.
- **A draft answers 404 to anyone but its owner**, on reading and on writing
  alike, so nothing confirms which draft ids exist.
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
- **Fields are read, and the draft's owner checked, before the provider is
  called.** A body that is not the shape the document takes is a 422 and a draft
  the caller cannot write to is a 404, both before any call is made. A turn takes
  a minute or more and is charged for, so finding out afterwards wastes both.
- **Nothing is saved until an agreement is settled on.** A front desk exchange
  that goes nowhere leaves no row, so the library holds drafts rather than
  abandoned openings. A turn the provider failed leaves nothing behind either.
- **`save_turn` never merges.** Every turn already carries its whole state, so
  saving it is a wholesale overwrite and two turns racing on one draft are last
  write wins by row rather than a torn one. This is why no `BEGIN IMMEDIATE` is
  needed: there is still no ordered read-modify-write in this schema.
- **The chat prompt names every clause of every document**, pinned by a test,
  because nothing reads `templates/*.md` at runtime. A second test re-runs the
  generator and fails if the committed output has drifted from the templates.
- **Frontend test contract.** The suites assert on accessible names, roles and
  text, never `data-testid`. Check before any restyle.

## Where the code lives

```
documents/      <slug>.spec.json by hand, <slug>.clauses.json generated
backend/app/    routers -> ai -> domain -> core, dependencies one way only
  core/         config, engine, session cookie and password hashing,
                the auth dependency
  domain/       models, schemas, accounts, saved drafts, the field vocabulary,
                the document registry and the merge
  ai/           the provider client, the front desk and drafting prompts
  routers/      one module per resource, all mounted under /api
frontend/
  scripts/      generate-clauses.mjs, run by npm run generate
  src/app/      page.tsx (chat beside the document, resumed from ?draft=),
                login/, signup/, drafts/, globals.css
  src/components/  AuthGate (the session), AppHeader (the shell),
                ChatPanel, DocumentView
  src/lib/      api.ts (the one API client), documents.ts (the spec shape),
                fields.ts (how a field reads once filled),
                disclaimer.ts (said once, rendered twice)
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
- **A reload comes back to the draft, but a restart does not.** The first turn
  that settles on an agreement puts its id in the address, and the draft is
  saved, so reloading resumes. The database is still rebuilt on every container
  start, so accounts and their drafts last only as long as the container.
- **The conversation before an agreement is settled on is not saved.** Reloading
  during the opening exchange starts over, because there is no draft yet to save
  it into.
