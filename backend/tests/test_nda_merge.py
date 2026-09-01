from app.domain.nda import NdaDetails, NdaFieldsUpdate, merge_fields


def test_a_field_the_turn_did_not_mention_is_left_standing():
    current = NdaDetails(governingLaw="Delaware")

    merged = merge_fields(current, NdaFieldsUpdate(jurisdiction="New Castle, DE"))

    assert merged.governingLaw == "Delaware"
    assert merged.jurisdiction == "New Castle, DE"


def test_a_field_the_turn_names_is_written():
    merged = merge_fields(NdaDetails(), NdaFieldsUpdate(purpose="Evaluating a deal."))

    assert merged.purpose == "Evaluating a deal."


def test_a_value_the_user_changed_their_mind_about_is_replaced():
    current = NdaDetails(governingLaw="Delaware")

    merged = merge_fields(current, NdaFieldsUpdate(governingLaw="New York"))

    assert merged.governingLaw == "New York"


def test_the_parties_are_merged_apart():
    current = NdaDetails()
    current.partyOne.company = "Acme Inc"

    merged = merge_fields(
        current, NdaFieldsUpdate(partyTwo={"company": "Beta Ltd"})
    )

    assert merged.partyOne.company == "Acme Inc"
    assert merged.partyTwo.company == "Beta Ltd"


def test_one_detail_of_a_party_does_not_wipe_the_rest():
    current = NdaDetails()
    current.partyOne.company = "Acme Inc"

    merged = merge_fields(current, NdaFieldsUpdate(partyOne={"name": "Ada Lovelace"}))

    assert merged.partyOne.company == "Acme Inc"
    assert merged.partyOne.name == "Ada Lovelace"


def test_a_turn_that_found_nothing_changes_nothing():
    current = NdaDetails(purpose="Evaluating a deal.", governingLaw="Delaware")

    assert merge_fields(current, NdaFieldsUpdate()) == current


def test_the_defaults_a_turn_never_mentions_survive():
    merged = merge_fields(NdaDetails(), NdaFieldsUpdate(purpose="Evaluating a deal."))

    assert merged.termKind == "expires"
    assert merged.termYears == 1
    assert merged.confidentialityKind == "years"


def test_the_kind_of_term_can_be_changed():
    merged = merge_fields(NdaDetails(), NdaFieldsUpdate(termKind="untilTerminated"))

    assert merged.termKind == "untilTerminated"
