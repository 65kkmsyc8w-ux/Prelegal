from app.core.db import get_session
from app.main import app
from app.routers import chat as chat_router

NDA = "mutual-nda"


def turn(client, message, document=NDA, **body):
    return client.post(
        "/api/chat/message",
        json={"message": message, "document": document, **body},
    )


def test_the_library_needs_a_session(client):
    assert client.get("/api/drafts").status_code == 401
    assert client.get("/api/drafts/1").status_code == 401


def test_a_new_account_has_nothing_in_its_library(signed_in_client):
    response = signed_in_client.get("/api/drafts")

    assert response.status_code == 200
    assert response.json() == []


def test_the_front_desk_saves_nothing(signed_in_client, ai_turn):
    """Nothing is stored until an agreement is settled on, so an opening that
    goes nowhere leaves no card behind."""
    ai_turn(reply="We cannot draft that.", document=None)

    body = turn(signed_in_client, "An employment contract.", None).json()

    assert body["draftId"] is None
    assert signed_in_client.get("/api/drafts").json() == []


def test_settling_on_an_agreement_opens_a_draft(signed_in_client, ai_turn):
    ai_turn(reply="A Pilot Agreement then.", document="pilot-agreement")

    body = turn(signed_in_client, "A trial of our product.", None).json()

    assert body["draftId"] is not None
    assert len(signed_in_client.get("/api/drafts").json()) == 1


def test_the_library_names_the_agreement_rather_than_its_slug(
    signed_in_client, ai_turn
):
    """The browser holds a slug but not what it is called, so the title is
    resolved here."""
    ai_turn(document="service-level-agreement")

    turn(signed_in_client, "An SLA please.", None)

    card = signed_in_client.get("/api/drafts").json()[0]

    assert card["document"] == "service-level-agreement"
    assert card["title"] == "Service Level Agreement"
    assert card["updatedAt"]


def test_a_later_turn_carries_on_the_same_draft(signed_in_client, ai_turn):
    ai_turn(purpose="Evaluating a deal.")
    opened = turn(signed_in_client, "Evaluating a deal.").json()["draftId"]

    ai_turn(governingLaw="Delaware")
    carried = turn(
        signed_in_client, "Delaware law.", draftId=opened, fields={}
    ).json()["draftId"]

    assert carried == opened
    assert len(signed_in_client.get("/api/drafts").json()) == 1


def test_a_draft_keeps_what_was_said_and_what_was_gathered(signed_in_client, ai_turn):
    ai_turn(reply="Which state's law?", purpose="Evaluating a deal.")

    opened = turn(signed_in_client, "Evaluating a deal.").json()["draftId"]
    detail = signed_in_client.get(f"/api/drafts/{opened}").json()

    assert detail["document"] == NDA
    assert detail["fields"]["purpose"] == "Evaluating a deal."
    assert detail["transcript"] == [
        {"role": "user", "content": "Evaluating a deal."},
        {"role": "assistant", "content": "Which state's law?"},
    ]


def test_a_draft_keeps_the_whole_thread_it_was_settled_from(
    signed_in_client, ai_turn
):
    """The front desk exchange is saved too, once there is a draft to save it
    into, so reopening reads as the conversation that actually happened."""
    ai_turn(reply="A Mutual NDA then.", document=NDA)

    opened = turn(
        signed_in_client,
        "An NDA please.",
        None,
        history=[
            {"role": "assistant", "content": "What kind of agreement do you need?"}
        ],
    ).json()["draftId"]

    transcript = signed_in_client.get(f"/api/drafts/{opened}").json()["transcript"]

    assert [entry["content"] for entry in transcript] == [
        "What kind of agreement do you need?",
        "An NDA please.",
        "A Mutual NDA then.",
    ]


def test_reopening_a_draft_sends_the_shape_to_render_it_with(
    signed_in_client, ai_turn
):
    ai_turn(document="pilot-agreement")
    opened = turn(signed_in_client, "A pilot.", None).json()["draftId"]

    detail = signed_in_client.get(f"/api/drafts/{opened}").json()

    assert detail["documentSpec"]["title"] == "Pilot Agreement"
    assert "clauses" not in detail["documentSpec"]


def test_changing_the_agreement_keeps_one_draft_and_empties_it(
    signed_in_client, ai_turn
):
    ai_turn(purpose="Evaluating a deal.")
    opened = turn(signed_in_client, "Evaluating a deal.").json()["draftId"]

    ai_turn(reply="A Pilot Agreement then.", document="pilot-agreement")
    swapped = turn(
        signed_in_client,
        "Make it a pilot instead.",
        draftId=opened,
        fields={"purpose": "Evaluating a deal."},
    ).json()

    assert swapped["draftId"] == opened
    detail = signed_in_client.get(f"/api/drafts/{opened}").json()
    assert detail["document"] == "pilot-agreement"
    assert "purpose" not in detail["fields"]


def test_the_library_lists_the_most_recently_worked_on_first(
    signed_in_client, ai_turn
):
    ai_turn(document=NDA)
    turn(signed_in_client, "An NDA.", None)
    ai_turn(document="pilot-agreement")
    turn(signed_in_client, "A pilot.", None)

    titles = [card["title"] for card in signed_in_client.get("/api/drafts").json()]

    assert titles == ["Pilot Agreement", "Mutual Non-Disclosure Agreement"]


def test_a_draft_that_never_existed_is_not_found(signed_in_client):
    assert signed_in_client.get("/api/drafts/999").status_code == 404


def test_one_account_cannot_read_anothers_draft(signed_in_as, ai_turn):
    ada = signed_in_as()
    grace = signed_in_as(email="grace@example.com", display_name="Grace")
    ai_turn(document=NDA)
    hers = turn(ada, "An NDA.", None).json()["draftId"]

    assert grace.get(f"/api/drafts/{hers}").status_code == 404
    assert grace.get("/api/drafts").json() == []


def test_one_account_cannot_write_to_anothers_draft(signed_in_as, ai_turn):
    ada = signed_in_as()
    grace = signed_in_as(email="grace@example.com", display_name="Grace")
    ai_turn(document=NDA)
    hers = turn(ada, "An NDA.", None).json()["draftId"]

    assert turn(grace, "Delaware law.", draftId=hers).status_code == 404


def test_a_draft_nobody_owns_is_refused_before_the_provider_is_called(
    signed_in_client, monkeypatch
):
    """Checked with the fields, for the same reason: a stale tab costs a 404
    rather than a minute of waiting and a charge for an answer nothing can use."""

    def refuse(*_args, **_kwargs):
        raise AssertionError("an unusable draft must not reach the provider")

    monkeypatch.setattr(chat_router.client, "complete_structured", refuse)

    assert turn(signed_in_client, "Hello", draftId=999).status_code == 404


def test_a_turn_the_provider_failed_leaves_no_draft_behind(
    signed_in_client, monkeypatch
):
    def fail(*_args, **_kwargs):
        raise chat_router.client.AiError("The AI answered with nothing")

    monkeypatch.setattr(chat_router.client, "complete_structured", fail)

    assert turn(signed_in_client, "An NDA.", None).status_code == 502
    assert signed_in_client.get("/api/drafts").json() == []


def test_no_transaction_is_held_across_the_provider_call(
    signed_in_client, session_factory, monkeypatch
):
    """The route reads before it calls: the caller's account, and the draft if
    one was named. A SELECT alone opens a transaction, and holding it open for
    the 30 to 150 seconds a turn takes would make every other request wanting to
    commit wait out the busy timeout and fail."""
    sessions = []

    def capture():
        with session_factory() as session:
            sessions.append(session)
            yield session

    app.dependency_overrides[get_session] = capture

    open_at_the_call = []

    def watch(_messages, schema):
        open_at_the_call.append(sessions[-1].in_transaction())
        return schema.model_validate({"reply": "Noted.", "fields": {}})

    monkeypatch.setattr(chat_router.client, "complete_structured", watch)

    assert turn(signed_in_client, "Hello").status_code == 200
    assert open_at_the_call == [False]
