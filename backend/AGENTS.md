# Backend

FastAPI, SQLAlchemy and SQLite, run by uv. Nothing is installed on the host:
the app and these tests run in Docker.

## Layers

Four packages, and the dependencies only point one way:

```
routers -> domain -> core
```

`core` holds config, the engine, the session cookie and the auth dependency.
`domain` holds the models, the schemas and the mutations. `routers` holds one
module per resource, each mounted under `/api`.

PL-6 adds an `ai/` package between `routers` and `domain`. It is not here yet
because nothing calls a model provider.

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

## Deliberately absent

Do not add these back without a reason that exists in the code.

- **No migration machinery.** Nothing mounts a volume, so the container never
  starts against a database from an earlier build. `init_db` is `create_all`.
- **No `BEGIN IMMEDIATE` or `isolation_level = None`.** That guards ordered
  read-modify-write, which this schema has none of. Revisit when a later ticket
  adds rows whose order matters.
- **No password hashing.** PL-5 is a fake login by instruction. PL-8 adds real
  authentication, and `core/security.py` is where it goes.
- **No `OPENROUTER_API_KEY` check in the lifespan.** Nothing calls the provider
  yet, and refusing to boot over an unused variable would be a lie about what
  the container needs.

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
