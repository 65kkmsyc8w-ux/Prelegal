# Backend

FastAPI, SQLAlchemy and SQLite, run by uv. Nothing is installed on the host:
the app and these tests run in Docker.

## Layers

Four packages, and the dependencies only point one way:

```
routers -> ai -> domain -> core
```

`core` holds config, the engine, the session cookie, password hashing and the
auth dependency.
`domain` holds the models, the schemas, the mutations and the document shapes.
`ai` holds the provider client and the chat prompt. `routers` holds one module
per resource, each mounted under `/api`.

`domain/fields.py` holds the field vocabulary, the models built from it and the
merge. `domain/documents.py` loads the eleven declarations. Neither knows
anything about the assistant. That is what keeps the arrow pointing one way: the
merge is document logic, so `ai` depends on it rather than owning it, and
`domain` never imports from `ai`.

## Where a document comes from

A document type is declared in two files under `documents/`, at the repository
root, both copied into the image:

- `<slug>.spec.json`, written by hand. What the cover page asks for, how each
  field reads once filled, and what the assistant should be told each field
  means.
- `<slug>.clauses.json`, generated from `templates/<slug>.md` by
  `frontend/scripts/generate-clauses.mjs`.

Only the Mutual NDA ships a cover page, in this repository or upstream at
Common Paper. The other ten name the values they need through
`<span class="..._link">` references in their own prose, and each spec's field
list is derived from those. Nothing was invented for them, and nothing was
fetched: the field list is what that agreement's own text demands.

Adding a twelfth document is one spec file, one template and a generator run.
There is no Python to write.

## Invariants

Each has a test behind it.

- **`main.py` route order.** `StaticFiles` is mounted at `/` as a catch-all, so
  a route registered after the mount is unreachable. Every `include_router` goes
  above that line. `test_static.py` holds it.
- **`DATA_DIR` is `parents[2]`** from `app/core/db.py`, which is `/app/data`.
  `parent.parent` is `/app/app`, inside the app package.
- **`domain/` flushes, routers commit.** `sign_up` and `save_turn` mutate and
  flush; the router owns the transaction.
- **A session cookie can outlive the account it names.** The database is rebuilt
  on every container start but the browser keeps its cookie, so `current_user`
  looks the row up and answers 401 when it is gone rather than trusting the
  signature alone.
- **The name on a sign up is stripped before it is validated**, so a name of
  nothing but spaces is a 422 rather than an account with a blank name. The
  email is stripped and lower cased for the same reason: a stray space or a
  capital is the same account. The password is neither. It is stored and
  compared exactly as typed, and trimming it on the way in but not on the way
  back would lock out anyone whose password ends in a space.
- **Sign in gives one answer for two failures.** An unregistered email and a
  wrong password are the same 401 with the same message, so the route cannot be
  used to find out which addresses have accounts. `test_auth.py` asserts the two
  messages are equal rather than asserting each separately.
- **The loser of a sign-up race is refused, not signed in.** The old name-based
  login coalesced a race into one account, because a name was all there was to
  go on. Two sign ups under one email may carry different passwords, so handing
  the loser the winner's row would sign them in to somebody else's account. It
  gets a 409.
- **No transaction is open across the OpenRouter call.** This survived the chat
  becoming stateful, but it is now true by mechanism rather than by having no
  database access at all: `routers/chat.py` resolves the caller and checks the
  draft, then commits, and only then asks the provider. A SELECT alone opens a
  transaction holding SQLite's shared lock, and a turn takes 30 to 150 seconds,
  so anything else wanting to commit in that window would wait out the 10 second
  busy timeout and fail. `test_drafts.py` pins it by asking the session whether
  it is in a transaction at the moment the provider is called.
- **The draft's owner is checked before the provider is called**, alongside the
  fields, and for the same reason: a stale tab costs a 404 rather than a minute
  of waiting and a charge for an answer nothing can use.
- **A draft answers 404 to anyone but its owner**, reading and writing alike, so
  nothing confirms which draft ids exist.
- **Nothing is saved until a document is settled on.** A front desk exchange
  that never settles leaves no row, and a turn the provider failed leaves none
  either, so the library holds drafts rather than abandoned openings.
- **`save_turn` never merges.** Every turn carries its whole state already, so
  persisting it is a wholesale overwrite of `document`, `fields` and
  `transcript`. Two turns racing on one draft are last write wins by row rather
  than a torn write.
- **`merge_fields` reads None as "the message did not mention it"**, never as
  "clear it". A turn that says nothing about a field leaves it standing. The
  model is asked to leave untouched fields null but often echoes them back
  instead, and both answers have to come out the same. An empty string counts as
  not mentioned too. A field whose value is an object merges a level down, so one
  detail of a party arriving does not wipe the rest of that party.
- **A slug the assistant did not get from the catalog names nothing.** It is
  read the same way as naming no document at all, so an invented document costs
  one more turn rather than a 500.
- **Changing document mid-conversation empties the cover page.** Field keys
  belong to the document they were gathered for, so none of them carry over.
- **The wire carries the declaration, not the terms.** `DocumentOut` leaves
  `clauses` out: the browser has them already, generated from the same
  templates, and the longer agreements would put several thousand words on the
  wire every turn.
- **The browser still sends the whole state every turn**, the transcript and
  the fields both. It is no longer the only copy, but it is still what the turn
  is computed from, which is what makes saving an overwrite rather than a
  read-modify-write.
- **`test_chat_prompt.py` pins every clause heading of every document.**
  Nothing reads `templates/*.md` at runtime and they are not copied into the
  image, so that test is what keeps the generated clauses honest on this side.
  `frontend/src/content/generated/generated.test.ts` is what keeps them honest
  against the templates themselves.

There is no longer a test pinning the cover page field names against the
frontend. There was one, because `domain/nda.py` was transcribed by hand from
`frontend/src/lib/nda.ts` and the two could drift. Neither file exists now: the
browser is sent the same declaration the backend loaded, so the two cannot
disagree about a field name. `test_documents.py` checks the declarations
themselves instead.

## Deliberately absent

Do not add these back without a reason that exists in the code.

- **No migration machinery.** Nothing mounts a volume, so the container never
  starts against a database from an earlier build. `init_db` is `create_all`.
- **No `BEGIN IMMEDIATE` or `isolation_level = None`.** That guards ordered
  read-modify-write, which this schema has none of. Revisit when a later ticket
  adds rows whose order matters.
- **No password hashing library.** `hashlib.scrypt` is in the standard library
  and is a memory-hard KDF; the cost parameters in `core/security.py` are
  Django's `ScryptPasswordHasher` defaults rather than invented ones. bcrypt and
  argon2-cffi are both compiled extensions, and this backend is six packages.
- **No email validation library.** `pydantic[email]` pulls in email-validator to
  check deliverability, and nothing here posts mail. `domain/schemas.py` checks
  the shape, which is what stops a display name being typed into the address box.
- **No `BEGIN IMMEDIATE` still.** The chat now writes, but `save_turn` is a
  wholesale overwrite rather than an ordered read-modify-write, so there is
  still nothing whose order a concurrent writer could corrupt.

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
