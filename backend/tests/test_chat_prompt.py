import pytest

from app.ai.chat import build_messages, build_prompt, turn_schema
from app.core import config
from app.domain.documents import DOCUMENTS
from app.domain.schemas import ChatEntry

SPECS = list(DOCUMENTS.values())
IDS = [spec.slug for spec in SPECS]
NDA = DOCUMENTS["mutual-nda"]


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_the_prompt_names_every_clause_of_the_terms(spec):
    """Nothing reads templates/*.md at runtime and they are not copied into the
    image, so this is what keeps the generated clauses honest on this side."""
    prompt = build_prompt(spec)

    for clause in spec.clauses:
        assert clause.heading in prompt


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_the_prompt_names_every_field_the_cover_page_needs(spec):
    prompt = build_prompt(spec)

    for field in spec.fields:
        assert field.key in prompt


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_the_prompt_says_which_agreement_is_being_drafted(spec):
    assert spec.title in build_prompt(spec)


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_the_prompt_offers_the_values_an_enumerated_field_allows(spec):
    prompt = build_prompt(spec)

    for field in spec.fields:
        for option in field.options:
            assert option.value in prompt
        for mode in field.modes:
            assert mode.value in prompt


def test_the_front_desk_names_every_document_it_can_draft():
    prompt = build_prompt(None)

    for spec in SPECS:
        assert spec.slug in prompt
        assert spec.title in prompt


def test_the_front_desk_is_told_to_offer_the_nearest_thing_it_can_draft():
    prompt = build_prompt(None)

    assert "cannot draft" in prompt
    assert "closest" in prompt


def test_the_front_desk_answers_with_a_document_and_nothing_else():
    schema = turn_schema(None)

    assert set(schema.model_fields) == {"reply", "document"}


@pytest.mark.parametrize("spec", SPECS, ids=IDS)
def test_a_drafting_turn_answers_with_the_document_it_is_drafting(spec):
    schema = turn_schema(spec)

    assert set(schema.model_fields) == {"reply", "document", "fields"}


def test_what_is_already_known_is_handed_to_the_model():
    messages = build_messages(NDA, {"governingLaw": "Delaware"}, [], "Hello")

    assert "Delaware" in messages[1]["content"]


def test_the_front_desk_is_not_handed_fields_it_has_no_shape_for():
    messages = build_messages(None, {}, [], "Hello")

    assert len(messages) == 2
    assert messages[-1]["content"] == "Hello"


def test_the_conversation_arrives_in_order_with_the_new_message_last():
    history = [
        ChatEntry(role="user", content="First"),
        ChatEntry(role="assistant", content="Second"),
    ]

    messages = build_messages(NDA, {}, history, "Third")

    assert [message["content"] for message in messages[2:]] == [
        "First",
        "Second",
        "Third",
    ]


def test_a_long_conversation_is_trimmed_before_it_reaches_the_model():
    history = [
        ChatEntry(role="user", content=str(number))
        for number in range(config.MAX_CHAT_HISTORY + 10)
    ]

    messages = build_messages(NDA, {}, history, "Latest")

    # Two system messages, the trimmed history, and the new message.
    assert len(messages) == config.MAX_CHAT_HISTORY + 3
    assert messages[2]["content"] == "10"
