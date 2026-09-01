"""The merge rule, against a spec of one of each field type.

This was `test_nda_merge.py` when there was one document. The rule it pins has
not changed: what a turn does not mention is left standing.
"""

from app.domain.fields import (
    FieldSpec,
    details_model,
    merge_fields,
    update_model,
)

FIELDS = [
    FieldSpec(key="purpose", label="Purpose", type="text", prompt="the purpose"),
    FieldSpec(key="effectiveDate", label="Effective Date", type="date", prompt="the date"),
    FieldSpec(key="capAmount", label="Cap Amount", type="money", prompt="the cap"),
    FieldSpec(
        key="paymentProcess",
        label="Payment Process",
        type="choice",
        prompt="how payment is made",
        options=[
            {"value": "invoice", "label": "Invoice"},
            {"value": "automatic", "label": "Automatic"},
        ],
    ),
    FieldSpec(
        key="term",
        label="Term",
        type="duration",
        prompt="how long it runs",
        modes=[
            {"value": "expires", "label": "Expires", "countedInYears": True, "template": "{years}."},
            {"value": "untilTerminated", "label": "Until terminated", "template": "Until terminated."},
        ],
    ),
    FieldSpec(key="partyOne", label="Party 1", type="party", prompt="the first party"),
    FieldSpec(key="partyTwo", label="Party 2", type="party", prompt="the second party"),
]

Details = details_model("sample", FIELDS)
Update = update_model("sample", FIELDS)


def merge(current: dict, **found) -> dict:
    return merge_fields(FIELDS, current, Update(**found).model_dump())


def blank() -> dict:
    return Details().model_dump()


def test_a_field_the_turn_did_not_mention_is_left_standing():
    merged = merge(blank() | {"purpose": "Evaluating a deal."}, capAmount="$1m")

    assert merged["purpose"] == "Evaluating a deal."
    assert merged["capAmount"] == "$1m"


def test_a_field_the_turn_names_is_written():
    assert merge(blank(), purpose="Evaluating a deal.")["purpose"] == "Evaluating a deal."


def test_a_value_the_user_changed_their_mind_about_is_replaced():
    merged = merge(blank() | {"purpose": "One thing"}, purpose="Another thing")

    assert merged["purpose"] == "Another thing"


def test_the_parties_are_merged_apart():
    current = blank()
    current["partyOne"]["company"] = "Acme Inc"

    merged = merge(current, partyTwo={"company": "Beta Ltd"})

    assert merged["partyOne"]["company"] == "Acme Inc"
    assert merged["partyTwo"]["company"] == "Beta Ltd"


def test_one_detail_of_a_party_does_not_wipe_the_rest():
    current = blank()
    current["partyOne"]["company"] = "Acme Inc"

    merged = merge(current, partyOne={"name": "Ada Lovelace"})

    assert merged["partyOne"]["company"] == "Acme Inc"
    assert merged["partyOne"]["name"] == "Ada Lovelace"


def test_one_part_of_a_duration_does_not_wipe_the_other():
    current = blank()
    current["term"] = {"mode": "expires", "years": 5}

    merged = merge(current, term={"mode": "expires"})

    assert merged["term"]["years"] == 5


def test_a_turn_that_found_nothing_changes_nothing():
    current = blank() | {"purpose": "Evaluating a deal.", "capAmount": "$1m"}

    assert merge(current) == current


def test_the_defaults_a_turn_never_mentions_survive():
    merged = merge(blank(), purpose="Evaluating a deal.")

    assert merged["term"] == {"mode": "expires", "years": 1}
    assert merged["paymentProcess"] == "invoice"


def test_the_kind_of_term_can_be_changed():
    assert merge(blank(), term={"mode": "untilTerminated"})["term"]["mode"] == (
        "untilTerminated"
    )


def test_an_empty_answer_does_not_wipe_what_was_already_known():
    """The model fills fields it knows nothing about with "" rather than null
    often enough that treating that as an instruction to clear would lose the
    user's answers mid-conversation."""
    current = blank() | {"purpose": "Evaluating a deal.", "capAmount": "$1m"}

    merged = merge(current, purpose="", capAmount="")

    assert merged["purpose"] == "Evaluating a deal."
    assert merged["capAmount"] == "$1m"


def test_an_empty_answer_does_not_wipe_a_party_either():
    current = blank()
    current["partyOne"]["company"] = "Acme Inc"

    merged = merge(current, partyOne={"company": ""})

    assert merged["partyOne"]["company"] == "Acme Inc"


def test_a_choice_is_held_to_the_values_the_spec_allows():
    from pydantic import ValidationError

    try:
        Update(paymentProcess="barter")
    except ValidationError:
        return
    raise AssertionError("a value outside the spec's options should not validate")
