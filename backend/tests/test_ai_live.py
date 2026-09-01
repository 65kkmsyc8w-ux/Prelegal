"""Real calls to OpenRouter. Deselected by default; run with -m live."""

import pytest

from app.ai import chat, client
from app.core import config
from app.domain.documents import DOCUMENTS
from app.domain.fields import details_model, merge_fields

pytestmark = pytest.mark.live

NDA = DOCUMENTS["mutual-nda"]


@pytest.fixture(autouse=True)
def needs_a_key():
    if not config.OPENROUTER_API_KEY:
        pytest.skip("OPENROUTER_API_KEY is not set")


def blank(spec=NDA) -> dict:
    return details_model(spec.slug, spec.fields)().model_dump()


def ask(spec, fields, message):
    messages = chat.build_messages(spec, fields, [], message)
    return client.complete_structured(messages, chat.turn_schema(spec))


def test_the_model_answers_in_the_shape_we_asked_for():
    turn = ask(NDA, blank(), "I need an NDA between Acme Inc and Beta Ltd.")

    assert turn.reply != ""


def test_the_model_takes_the_companies_out_of_a_sentence():
    turn = ask(
        NDA,
        blank(),
        "I need an NDA between Acme Inc and Beta Ltd to evaluate a supply arrangement.",
    )
    merged = merge_fields(NDA.fields, blank(), turn.fields.model_dump())

    assert merged["partyOne"]["company"] != ""
    assert merged["partyTwo"]["company"] != ""


def test_the_model_takes_two_values_out_of_one_message():
    known = blank() | {"purpose": "Evaluating a supply arrangement."}

    turn = ask(NDA, known, "Delaware law, and the courts in New Castle, DE.")
    merged = merge_fields(NDA.fields, known, turn.fields.model_dump())

    assert "Delaware" in merged["governingLaw"]
    assert "New Castle" in merged["jurisdiction"]


def test_a_turn_about_something_else_leaves_what_was_known_standing():
    """Asserted through the merge rather than on the raw fields: the model is
    asked to leave untouched fields null but often echoes them back instead,
    and either answer has to come out the same on the far side."""
    known = blank() | {
        "purpose": "Evaluating a supply arrangement.",
        "governingLaw": "Delaware",
    }

    turn = ask(NDA, known, "The effective date is 2026-09-01.")
    merged = merge_fields(NDA.fields, known, turn.fields.model_dump())

    assert merged["purpose"] != ""
    assert merged["governingLaw"] == "Delaware"


def test_the_front_desk_recognises_an_agreement_we_can_draft():
    turn = ask(None, {}, "We want a customer to trial our product for 30 days.")

    assert turn.document in DOCUMENTS


def test_the_front_desk_offers_the_nearest_thing_to_one_we_cannot_draft():
    """The reply is the model's to word. What is pinned is that it does not
    quietly settle on something the user did not ask for."""
    turn = ask(None, {}, "I need an employment contract for a new engineer.")

    assert turn.reply != ""
    assert turn.document is None or turn.document in DOCUMENTS


def test_a_larger_cover_page_still_comes_back_whole():
    """The Professional Services Agreement asks for the most of any document, so
    it is the one most likely to strain the schema the model answers in."""
    psa = DOCUMENTS["professional-services-agreement"]

    turn = ask(psa, blank(psa), "Acme Inc is buying services from Beta Ltd.")

    assert turn.reply != ""
    assert set(turn.fields.model_dump()) == {field.key for field in psa.fields}
