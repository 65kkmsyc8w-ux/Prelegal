from app.domain.nda import NdaDetails, NdaFieldsUpdate, Party, merge_fields


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


def test_the_cover_page_is_the_shape_the_browser_holds():
    """Pins the wire contract. NdaDetails is transcribed by hand from
    frontend/src/lib/nda.ts and the two are only ever sent to each other, so
    renaming a field here has to be a deliberate act that updates both. The
    backend's tests cannot read the frontend source: the test image carries the
    built export, not the TypeScript.
    """
    assert set(NdaDetails.model_fields) == {
        "purpose",
        "effectiveDate",
        "termKind",
        "termYears",
        "confidentialityKind",
        "confidentialityYears",
        "governingLaw",
        "jurisdiction",
        "modifications",
        "partyOne",
        "partyTwo",
    }
    assert set(Party.model_fields) == {"name", "title", "company", "noticeAddress"}


def test_an_empty_answer_does_not_wipe_what_was_already_known():
    """The model fills fields it knows nothing about with "" rather than null
    often enough that treating that as an instruction to clear would lose the
    user's answers mid-conversation."""
    current = NdaDetails(purpose="Evaluating a deal.", governingLaw="Delaware")

    merged = merge_fields(current, NdaFieldsUpdate(purpose="", governingLaw=""))

    assert merged.purpose == "Evaluating a deal."
    assert merged.governingLaw == "Delaware"


def test_an_empty_answer_does_not_wipe_a_party_either():
    current = NdaDetails()
    current.partyOne.company = "Acme Inc"

    merged = merge_fields(current, NdaFieldsUpdate(partyOne={"company": ""}))

    assert merged.partyOne.company == "Acme Inc"
