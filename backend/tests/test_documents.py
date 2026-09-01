"""What the eleven declarations have to hold true, whatever they declare.

These replace the pinned field list the one document type carried. That test
existed because `domain/nda.py` was transcribed by hand from
`frontend/src/lib/nda.ts` and the two could drift. Nothing is transcribed now:
the browser is sent the same declaration the backend loaded, so what is left to
check is that the declarations themselves are sound.
"""

import json

import pytest

from app.domain import documents
from app.domain.documents import DOCUMENTS
from app.domain.fields import FieldType, details_model, update_model

SPECS = list(DOCUMENTS.values())
IDS = [spec.slug for spec in SPECS]


def test_every_document_in_the_catalog_can_be_drafted():
    catalog = json.loads(documents.CATALOG_PATH.read_text(encoding="utf-8"))
    # The catalog lists the Mutual NDA twice, as a cover page and as standard
    # terms. They are two halves of one agreement, so eleven files name ten
    # slugs plus the NDA.
    named = {entry["filename"].removeprefix("templates/").removesuffix(".md")
             for entry in catalog}

    assert named - set(DOCUMENTS) == {"mutual-nda-cover-page"}
    assert set(DOCUMENTS) <= named


def test_there_are_eleven_documents():
    assert len(DOCUMENTS) == 11


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_a_document_asks_for_something(spec):
    assert spec.fields
    assert spec.clauses


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_a_document_names_the_parties_that_sign_it(spec):
    parties = [f for f in spec.fields if f.type is FieldType.PARTY]

    assert len(parties) == 2


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_a_document_describes_every_field_to_the_assistant(spec):
    for field in spec.fields:
        assert field.prompt, f"{spec.slug}.{field.key} has nothing to tell the model"
        assert field.label


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_field_keys_are_unique_within_a_document(spec):
    keys = [field.key for field in spec.fields]

    assert len(keys) == len(set(keys))


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_an_enumerated_field_offers_something_to_choose(spec):
    for field in spec.fields:
        if field.type is FieldType.CHOICE:
            assert field.options
        if field.type is FieldType.DURATION:
            assert field.modes
            assert all(mode.template for mode in field.modes)


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_a_document_builds_the_models_the_assistant_answers_in(spec):
    held = details_model(spec.slug, spec.fields)
    found = update_model(spec.slug, spec.fields)
    keys = {field.key for field in spec.fields}

    assert set(held.model_fields) == keys
    assert set(found.model_fields) == keys

    # Nothing is reported until a message says it. An object field reports an
    # object whose own values are all unset, rather than nothing at all, so that
    # one detail of a party can arrive without the others.
    def unset(value) -> bool:
        return all(map(unset, value.values())) if isinstance(value, dict) else value is None

    assert unset(found().model_dump())


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_a_clause_that_substitutes_a_value_names_a_field_that_exists(spec):
    keys = {field.key for field in spec.fields}

    for occurrence in spec.inlineOccurrences:
        assert occurrence.key in keys


def test_a_slug_nobody_recognises_names_no_document():
    assert documents.resolve("not-a-document") is None
    assert documents.resolve(None) is None
    assert documents.resolve("mutual-nda").slug == "mutual-nda"


def test_the_listing_names_every_document_it_can_draft():
    listing = documents.listing()

    for spec in SPECS:
        assert spec.slug in listing
        assert spec.title in listing
