"""The eleven document types, loaded once at import.

A document is declared in two files under `documents/`:

- `<slug>.spec.json`, written by hand: what the cover page asks for, how each
  field reads once filled, and how the document introduces itself.
- `<slug>.clauses.json`, generated from `templates/<slug>.md` by
  `scripts/generate-clauses.mjs`: the terms themselves.

`templates/` is still never read at runtime and never enters the image. The
generated clause files are what the image carries, and a frontend test proves
they still match the templates they came from.
"""

import json
from pathlib import Path

from pydantic import BaseModel

from app.domain.fields import FieldSpec

# `documents/` sits beside `backend/` in a checkout and at `/app/documents` in
# the image, so the depth differs. Both are found by walking up for the
# directory itself rather than counting parents.
DOCUMENTS_DIR = next(
    parent / "documents"
    for parent in Path(__file__).resolve().parents
    if (parent / "documents").is_dir()
)
CATALOG_PATH = DOCUMENTS_DIR.parent / "catalog.json"


class Subclause(BaseModel):
    number: str
    heading: str
    body: str


class Clause(BaseModel):
    """One numbered term. The ten agreements carry their text in subclauses; the
    Mutual NDA states each clause in one paragraph and has none."""

    number: str
    heading: str
    body: str = ""
    subclauses: list[Subclause] = []


class InlineOccurrence(BaseModel):
    """Names the one mention of a label that states its value in the sentence,
    rather than referring back to the cover page. Every other mention is left as
    the defined term, which is how the agreements are written to read."""

    clause: str
    label: str
    occurrence: int
    key: str


class DocumentSpec(BaseModel):
    slug: str
    title: str
    shortName: str
    description: str = ""
    source: str = ""
    preamble: str = ""
    coverPageHeading: str = "Cover Page"
    termsHeading: str = "Standard Terms"
    closing: str = ""
    attribution: str = ""
    fields: list[FieldSpec]
    inlineOccurrences: list[InlineOccurrence] = []
    clauses: list[Clause] = []


def _descriptions() -> dict[str, str]:
    """Slug to description, from the catalog. The Mutual NDA has two catalog
    entries, a cover page and standard terms; the terms describe the agreement."""
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return {
        Path(entry["filename"]).stem: entry["description"] for entry in catalog
    }


def _load() -> dict[str, DocumentSpec]:
    descriptions = _descriptions()
    documents = {}
    for path in sorted(DOCUMENTS_DIR.glob("*.spec.json")):
        spec = json.loads(path.read_text(encoding="utf-8"))
        slug = spec["slug"]
        spec["description"] = descriptions[slug]
        clauses = DOCUMENTS_DIR / f"{slug}.clauses.json"
        spec["clauses"] = json.loads(clauses.read_text(encoding="utf-8"))
        documents[slug] = DocumentSpec.model_validate(spec)
    return documents


DOCUMENTS: dict[str, DocumentSpec] = _load()


def resolve(slug: str | None) -> DocumentSpec | None:
    """The document a slug names, or None. An unrecognised slug is not an error:
    it is what the assistant sends before it has settled on a document, and what
    it sends if it invents one, and both mean the same thing here."""
    return DOCUMENTS.get(slug) if slug else None


def listing() -> str:
    """The catalog as the assistant sees it when working out what is wanted."""
    return "\n".join(
        f"- {spec.slug}: {spec.title}. {spec.description}"
        for spec in DOCUMENTS.values()
    )
