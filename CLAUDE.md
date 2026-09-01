# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The current implementation supports all 11 document types via AI chat with full user authentication and document persistence.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make calls to LLMs, use your Cerebras skill to use LiteLLM via OpenRouter to the `nvidia/nemotron-3.5-lightning:free` model with Cerebras as the inference provider. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

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

## Implementation Status

Jira PL-2 and PL-3 are done. PL-5 is the current ticket; PL-6, PL-7 and PL-8
are not started, so there is no AI chat, no document persistence and no real
authentication in the codebase yet.

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

### Not built yet

- AI chat (PL-6), the other ten document types (PL-7), real authentication and
  saved documents (PL-8).

### Current API endpoints

- `GET /api/health` - health check, used by the start scripts
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
- **Frontend test contract.** The suites assert on accessible names, roles and
  text, never `data-testid`. Check before any restyle.
