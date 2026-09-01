import re

from app.ai.chat import CLAUSES, SYSTEM_PROMPT, build_messages
from app.core import config
from app.domain.nda import NdaDetails
from app.domain.schemas import ChatEntry

HEADINGS = [
    "Introduction",
    "Use and Protection of Confidential Information",
    "Exceptions",
    "Disclosures Required by Law",
    "Term and Termination",
    "Return or Destruction of Confidential Information",
    "Proprietary Rights",
    "Disclaimer",
    "Governing Law and Jurisdiction",
    "Equitable Relief",
    "General",
]


def test_the_prompt_names_every_clause_of_the_standard_terms():
    """Nothing reads templates/mutual-nda.md at runtime and it is not copied
    into the image, so this is what keeps the transcription honest."""
    for heading in HEADINGS:
        assert heading in SYSTEM_PROMPT


def test_the_prompt_carries_all_eleven_clauses_and_no_more():
    assert len(re.findall(r"(?m)^\d+ ", CLAUSES)) == 11


def test_the_prompt_names_every_field_the_cover_page_needs():
    for field in NdaDetails.model_fields:
        assert field in SYSTEM_PROMPT


def test_what_is_already_known_is_handed_to_the_model():
    messages = build_messages(NdaDetails(governingLaw="Delaware"), [], "Hello")

    assert "Delaware" in messages[1]["content"]


def test_the_conversation_arrives_in_order_with_the_new_message_last():
    history = [
        ChatEntry(role="user", content="First"),
        ChatEntry(role="assistant", content="Second"),
    ]

    messages = build_messages(NdaDetails(), history, "Third")

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

    messages = build_messages(NdaDetails(), history, "Latest")

    # Two system messages, the trimmed history, and the new message.
    assert len(messages) == config.MAX_CHAT_HISTORY + 3
    assert messages[2]["content"] == "10"
