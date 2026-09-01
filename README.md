# Prelegal

A platform for drafting common legal agreements.

## Status

**In progress.** The project is under active development and is targeted for
completion by **7 September 2026**.

The Mutual NDA creator is the first drafting tool to land, and it now runs
inside the full V1 foundation: a FastAPI backend, a SQLite database and a
Docker container serving the built frontend. AI chat, the remaining ten
document types and real authentication are still to come.

## Running it

Docker is the only requirement; nothing else is installed on the host.

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

The login screen asks for a display name and nothing else. **There is no
authentication yet**: no password is taken and nothing is verified. Signing in
under a name already used returns to that same account.

The database is rebuilt from scratch on every container start. Nothing mounts a
volume, so accounts and the work under them last only as long as the container.

## Architecture

One container. A `node:24-slim` stage runs `next build` with `output: "export"`,
and the resulting `out/` is copied into a `python:3.13-slim` image as
`/app/static`. FastAPI serves the API under `/api` and that static export at
`/`. There is no Node at runtime and no second origin, so the frontend calls
`/api/...` directly with no CORS layer and no proxy.

`backend/` is a uv project laid out as `routers -> domain -> core`; see
[backend/AGENTS.md](backend/AGENTS.md) for its invariants. `frontend/` is the
Next.js app. NDA drafting is entirely client-side: the backend holds accounts
and nothing else yet.

## Mutual NDA creator

Fill in the cover page and the agreement builds as you type, the cover page and
the Standard Terms together, alongside the form. Anything left blank shows as a
placeholder in square brackets. Download opens the browser print dialog; choose
Save as PDF to keep a copy.

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
the app now needs the API behind it. Start it first, then run the suite; set
`E2E_BASE_URL` to point somewhere other than `http://localhost:4000`. The
browsers install once with `npx playwright install`.

[docs/manual-tests.md](docs/manual-tests.md) lists what the suites cannot
reach, chiefly the browser's own print dialog and the saved PDF.

## Frontend development

`next dev` serves the frontend alone, with no API behind it, so the login screen
and the session gate cannot work there. Use it for styling and component work;
use the container for anything that signs in.

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
