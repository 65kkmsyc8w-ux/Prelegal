"""Real calls to OpenRouter. Deselected by default; run with -m live."""

import pytest

from app.ai import chat, client
from app.core import config
from app.domain.nda import NdaDetails, merge_fields

pytestmark = pytest.mark.live


@pytest.fixture(autouse=True)
def needs_a_key():
    if not config.OPENROUTER_API_KEY:
        pytest.skip("OPENROUTER_API_KEY is not set")


def test_the_model_answers_in_the_shape_we_asked_for():
    messages = chat.build_messages(
        NdaDetails(), [], "I need an NDA between Acme Inc and Beta Ltd."
    )

    turn = client.complete_structured(messages, chat.ChatTurn)

    assert turn.reply != ""


def test_the_model_takes_the_companies_out_of_a_sentence():
    messages = chat.build_messages(
        NdaDetails(),
        [],
        "I need an NDA between Acme Inc and Beta Ltd to evaluate a supply arrangement.",
    )

    turn = client.complete_structured(messages, chat.ChatTurn)
    merged = merge_fields(NdaDetails(), turn.fields)

    assert merged.partyOne.company != ""
    assert merged.partyTwo.company != ""


def test_the_model_takes_two_values_out_of_one_message():
    messages = chat.build_messages(
        NdaDetails(purpose="Evaluating a supply arrangement."),
        [],
        "Delaware law, and the courts in New Castle, DE.",
    )

    turn = client.complete_structured(messages, chat.ChatTurn)
    merged = merge_fields(NdaDetails(purpose="Evaluating a supply arrangement."), turn.fields)

    assert "Delaware" in merged.governingLaw
    assert "New Castle" in merged.jurisdiction


def test_a_turn_about_something_else_leaves_what_was_known_standing():
    """Asserted through the merge rather than on the raw fields: the model is
    asked to leave untouched fields null but often echoes them back instead,
    and either answer has to come out the same on the far side."""
    known = NdaDetails(purpose="Evaluating a supply arrangement.", governingLaw="Delaware")
    messages = chat.build_messages(known, [], "The effective date is 2026-09-01.")

    turn = client.complete_structured(messages, chat.ChatTurn)
    merged = merge_fields(known, turn.fields)

    assert merged.purpose != ""
    assert merged.governingLaw == "Delaware"
