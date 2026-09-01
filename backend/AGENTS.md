# Backend

FastAPI, SQLAlchemy and SQLite, run by uv. Nothing is installed on the host:
the app and these tests run in Docker.

## Layers

Four packages, and the dependencies only point one way:

```
routers -> ai -> domain -> core
```

`core` holds config, the engine, the session cookie and the auth dependency.
`domain` holds the models, the schemas, the mutations and the document shape.
`ai` holds the provider client and the chat prompt. `routers` holds one module
per resource, each mounted under `/api`.

`domain/nda.py` holds both shapes of the cover page and the merge, and knows
nothing about the assistant. That is what keeps the arrow pointing one way: the
merge is document logic, so `ai` depends on it rather than owning it, and
`domain` never imports from `ai`.

## Invariants

Each has a test behind it.

- **`main.py` route order.** `StaticFiles` is mounted at `/` as a catch-all, so
  a route registered after the mount is unreachable. Every `include_router` goes
  above that line. `test_static.py` holds it.
- **`DATA_DIR` is `parents[2]`** from `app/core/db.py`, which is `/app/data`.
  `parent.parent` is `/app/app`, inside the app package.
- **`domain/` flushes, routers commit.** `sign_in` mutates and flushes and the
  router owns the transaction.
- **A session cookie can outlive the account it names.** The database is rebuilt
  on every container start but the browser keeps its cookie, so `current_user`
  looks the row up and answers 401 when it is gone rather than trusting the
  signature alone.
- **The name on a session is stripped before it is validated**, so a name of
  nothing but spaces is a 422 rather than an account with a blank name.
- **`merge_fields` reads None as "the message did not mention it"**, never as
  "clear it". A turn that says nothing about a field leaves it standing. The
  model is asked to leave untouched fields null but often echoes them back
  instead, and both answers have to come out the same.
- **The chat stores nothing.** The browser holds the transcript and the fields
  and sends both, so no transaction is open across the provider call.
- **`test_chat_prompt.py` pins the eleven clause headings.** Nothing reads
  `templates/mutual-nda.md` at runtime and it is not copied into the image, so
  that test is what keeps the transcription in `ai/chat.py` honest.

## Deliberately absent

Do not add these back without a reason that exists in the code.

- **No migration machinery.** Nothing mounts a volume, so the container never
  starts against a database from an earlier build. `init_db` is `create_all`.
- **No `BEGIN IMMEDIATE` or `isolation_level = None`.** That guards ordered
  read-modify-write, which this schema has none of. Revisit when a later ticket
  adds rows whose order matters.
- **No password hashing.** PL-5 is a fake login by instruction. PL-8 adds real
  authentication, and `core/security.py` is where it goes.
- **No chat persistence.** PL-8 adds saved documents; until then a reload starts
  a new conversation, and the container holds nothing to lose.

## What the provider actually does

Measured against OpenRouter, not assumed. All three of these cost a working
build before they were understood.

- **The configured model is served by Nvidia, not Cerebras.** `EXTRA_BODY` asks
  for Cerebras first, per the project's Cerebras skill, and OpenRouter treats
  the order as a preference rather than a requirement.
- **Reasoning goes through `extra_body`, not litellm's `reasoning_effort`.**
  litellm refuses that argument for this model, and the call never leaves the
  process. Sent through `extra_body` it reaches OpenRouter untouched. It is not
  optional: without it the reasoning runs to the token limit and the answer
  comes back empty.
- **An empty answer is a normal outcome.** The provider returns a message with
  no content and `finish_reason` "stop" often enough to see it in a handful of
  calls. It is not truncation, so a larger budget does not prevent it, and the
  same request succeeds on the next attempt. `ATTEMPTS` is why.
- **Turns take 30 to 150 seconds.** The free model is slow. `TIMEOUT` allows
  for it.

## Commands

From the repo root. The test stage carries the built export, which is what
`test_static.py` needs.

```bash
docker build --target test -t prelegal-test . && docker run --rm prelegal-test
```

For backend-only iteration and lint, mount the source into the uv image. The
static tests fail this way: there is no export in the mounted tree.

```bash
docker run --rm -v "$PWD/backend":/src -w /src -e UV_PROJECT_ENVIRONMENT=/tmp/venv \
  ghcr.io/astral-sh/uv:0.9.9-python3.13-bookworm-slim \
  sh -c "uv sync --frozen --quiet && uv run --frozen pytest --ignore=tests/test_static.py --no-cov && uv run --frozen ruff check ."
```

`--no-cov` is needed for a subset run because `--cov-fail-under=80` is in
`addopts`.

`static/.gitkeep` keeps the mount point present in a source tree that has never
been built, so importing `app.main` does not fail on a missing directory.
