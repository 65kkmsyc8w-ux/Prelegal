# Prelegal

A platform for drafting common legal agreements.

## Status

**V1 complete**, ahead of its target of 7 September 2026.

All eleven Common Paper agreements can be drafted by talking to an assistant
rather than filling in a form, and the agreement builds beside the conversation
as it goes. Accounts are an email and a password, and every conversation that
settles on an agreement is saved and can be reopened later. It runs as one
Docker container: a FastAPI backend and a SQLite database serving the built
frontend.

## Running it

Docker is the only requirement; nothing else is installed on the host. Copy
`.env.example` to `.env` and fill in `OPENROUTER_API_KEY` first: the backend
refuses to start without it, because the chat has nothing to talk to.

```bash
# Mac
./scripts/start-mac.sh          # http://localhost:4000
./scripts/stop-mac.sh

# Linux
./scripts/start-linux.sh
./scripts/stop-linux.sh

# Windows
.\scripts\start-windows.ps1
.\scripts\stop-windows.ps1
```

The start scripts build the image, replace any running container and wait for
`GET /api/health` before reporting the address, so a container that fails to
stay up is reported as a failure rather than as a URL nothing is listening on.

## Signing in

Sign up with an email, your name and a password, and you are signed in straight
away. Coming back takes the email and the password. Passwords are hashed with
scrypt and never stored or returned.

The database is rebuilt from scratch on every container start. Nothing mounts a
volume, so accounts and the drafts under them last only as long as the
container. That is by design: the ticket asks for a temporary database.

## Architecture

One container. A `node:24-slim` stage runs `next build` with `output: "export"`,
and the resulting `out/` is copied into a `python:3.13-slim` image as
`/app/static`. FastAPI serves the API under `/api` and that static export at
`/`. There is no Node at runtime and no second origin, so the frontend calls
`/api/...` directly with no CORS layer and no proxy.

`backend/` is a uv project laid out as `routers -> ai -> domain -> core`; see
[backend/AGENTS.md](backend/AGENTS.md) for its invariants. `frontend/` is the
Next.js app, and the eleven agreements are declared in `documents/` and rendered
from one declaration the server sends.

## Drafting an agreement

Tell the assistant what you need. If it is not one of the eleven, it says so and
offers the nearest one it can draft. Once an agreement is settled on it asks
about it a couple of points at a time and fills in the cover page as you answer,
and the agreement builds beside the conversation, the cover page and the terms
together. Anything not yet settled shows as a placeholder in square brackets.
Download opens the browser print dialog; choose Save as PDF to keep a copy.

Every document Prelegal produces is a draft. The app says so on screen and on
the agreement itself, so the warning is in the PDF too: no lawyer has reviewed
it, and one should before it is signed or relied on.

## Your drafts

Each turn that settles on an agreement is saved under your account, with the
conversation and the cover page as they stand. **My drafts** lists them, and
opening one puts you back in the conversation where you left it, so you carry on
talking rather than starting again. A reload comes back to the draft too. A
container restart does not: the database goes with it.

The assistant runs on a free model and is slow: a turn takes between 30 seconds
and two and a half minutes. It occasionally answers with nothing at all, which
the backend retries once before reporting it.

## Tests

Backend, from the repo root:

```bash
docker build --target test -t prelegal-test . && docker run --rm prelegal-test
```

Frontend, from `frontend/`:

```bash
npm install
npm test                # unit and component tests
npm run lint
npm run test:e2e        # end to end, needs a running container
```

`npm run test:e2e` drives the real container rather than a dev server, because
the app now needs the API behind it. It answers the chat routes from the test
rather than from the model, so no end to end run is slow, costly or different
each time; what the model does with a real message is covered by the backend's
live tests instead:

```bash
docker run --rm --env-file .env prelegal-test pytest -m live --no-cov
```

Start the container first, then run the suite. Set `E2E_BASE_URL` to point
somewhere other than `http://localhost:4000`. The browsers install once with
`npx playwright install`.

[docs/manual-tests.md](docs/manual-tests.md) lists what the suites cannot
reach, chiefly the browser's own print dialog and the saved PDF.

## Frontend development

`next dev` serves the frontend alone, with no API behind it, so the login
screen, the session gate and the chat cannot work there. Use it for styling and
component work; use the container for anything that signs in or talks to the
assistant. Rebuild the container after a frontend change, since it serves the
built export rather than the source.

```bash
cd frontend
npm run dev             # http://localhost:3000
npm run build           # static export into frontend/out
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
