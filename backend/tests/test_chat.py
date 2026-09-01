from app.ai import client
from app.ai.chat import GREETING
from app.routers import chat as chat_router

NDA = "mutual-nda"


def draft(signed_in_client, message, document=NDA, **body):
    return signed_in_client.post(
        "/api/chat/message",
        json={"message": message, "document": document, **body},
    )


def test_the_greeting_opens_the_conversation(signed_in_client):
    response = signed_in_client.get("/api/chat/greeting")

    assert response.status_code == 200
    assert response.json()["reply"] == GREETING


def test_the_greeting_costs_nothing_at_the_provider(signed_in_client, monkeypatch):
    def refuse(*_args, **_kwargs):
        raise AssertionError("the greeting must not call the provider")

    monkeypatch.setattr(chat_router.client, "complete_structured", refuse)

    assert signed_in_client.get("/api/chat/greeting").status_code == 200


def test_chatting_needs_a_session(client):
    assert client.get("/api/chat/greeting").status_code == 401
    assert client.post("/api/chat/message", json={"message": "Hello"}).status_code == 401


def test_the_assistant_settles_on_a_document_before_anything_is_gathered(
    signed_in_client, ai_turn
):
    ai_turn(reply="That sounds like a Pilot Agreement.", document="pilot-agreement")

    body = draft(signed_in_client, "We want a customer to trial our product.", None).json()

    assert body["document"] == "pilot-agreement"
    assert body["documentSpec"]["title"] == "Pilot Agreement"


def test_an_agreement_we_cannot_draft_leaves_the_document_open(
    signed_in_client, ai_turn
):
    """The reply is the assistant's to write; what matters here is that nothing
    is settled on, so the conversation stays at the front desk."""
    ai_turn(
        reply="We cannot draft an employment contract. The closest is our Professional Services Agreement.",
        document=None,
    )

    body = draft(signed_in_client, "I need an employment contract.", None).json()

    assert body["document"] is None
    assert body["documentSpec"] is None
    assert "cannot draft" in body["reply"]


def test_a_document_the_assistant_invented_names_nothing(signed_in_client, ai_turn):
    ai_turn(reply="Here you go.", document="employment-contract")

    body = draft(signed_in_client, "An employment contract.", None).json()

    assert body["document"] is None


def test_the_browser_is_sent_the_shape_it_has_to_render(signed_in_client, ai_turn):
    """The frontend was never taught any document's fields. It is sent the same
    declaration the backend loaded, which is what stops the two drifting."""
    ai_turn(document="service-level-agreement")

    spec = draft(signed_in_client, "An SLA please.", None).json()["documentSpec"]

    assert [field["key"] for field in spec["fields"]][:2] == ["provider", "customer"]
    assert spec["title"] == "Service Level Agreement"
    # The terms are left out on purpose: the browser has them already, generated
    # from the same templates, and the longer agreements run to thousands of
    # words that would otherwise go over the wire every turn.
    assert "clauses" not in spec


def test_a_reply_carries_what_the_assistant_found(signed_in_client, ai_turn):
    ai_turn(reply="Which state's law?", purpose="Evaluating a deal.")

    body = draft(signed_in_client, "We want to evaluate a deal.").json()

    assert body["reply"] == "Which state's law?"
    assert body["fields"]["purpose"] == "Evaluating a deal."


def test_a_turn_that_says_nothing_of_a_field_leaves_it_standing(
    signed_in_client, ai_turn
):
    ai_turn(jurisdiction="New Castle, DE")

    body = draft(
        signed_in_client,
        "The courts in New Castle.",
        fields={"governingLaw": "Delaware"},
    ).json()

    assert body["fields"]["governingLaw"] == "Delaware"
    assert body["fields"]["jurisdiction"] == "New Castle, DE"


def test_the_parties_are_gathered_over_several_turns(signed_in_client, ai_turn):
    ai_turn(partyTwo={"company": "Beta Ltd"})

    body = draft(
        signed_in_client,
        "The other side is Beta Ltd.",
        fields={"partyOne": {"company": "Acme Inc"}},
    ).json()

    assert body["fields"]["partyOne"]["company"] == "Acme Inc"
    assert body["fields"]["partyTwo"]["company"] == "Beta Ltd"


def test_the_whole_cover_page_comes_back_however_little_changed(
    signed_in_client, ai_turn
):
    """The browser replaces its state with this wholesale, so it has to be
    complete rather than a patch."""
    ai_turn(purpose="Evaluating a deal.")

    fields = draft(signed_in_client, "Evaluating a deal.").json()["fields"]

    assert fields["term"] == {"mode": "expires", "years": 1}
    assert fields["partyOne"] == {
        "name": "",
        "title": "",
        "company": "",
        "noticeAddress": "",
    }


def test_changing_the_agreement_starts_its_cover_page_empty(signed_in_client, ai_turn):
    """Field keys belong to the document they were gathered for, so a Pilot
    Agreement cannot inherit an NDA's answers."""
    ai_turn(reply="A Pilot Agreement then.", document="pilot-agreement")

    body = draft(
        signed_in_client,
        "Actually make it a pilot agreement.",
        fields={"purpose": "Evaluating a deal.", "governingLaw": "Delaware"},
    ).json()

    assert body["document"] == "pilot-agreement"
    assert "purpose" not in body["fields"]
    assert body["fields"]["governingLaw"] == ""


def test_staying_on_the_same_agreement_keeps_what_was_gathered(
    signed_in_client, ai_turn
):
    ai_turn(document=NDA, jurisdiction="New Castle, DE")

    body = draft(
        signed_in_client,
        "The courts in New Castle.",
        fields={"governingLaw": "Delaware"},
    ).json()

    assert body["fields"]["governingLaw"] == "Delaware"


def test_a_message_of_nothing_but_spaces_is_refused(signed_in_client):
    assert draft(signed_in_client, "   ").status_code == 422


def test_fields_that_are_not_the_documents_shape_are_refused(
    signed_in_client, ai_turn
):
    ai_turn()

    response = draft(signed_in_client, "Hello", fields={"partyOne": "Acme Inc"})

    assert response.status_code == 422
    assert "Mutual Non-Disclosure Agreement" in response.json()["detail"]


def test_refusing_them_costs_nothing_at_the_provider(signed_in_client, monkeypatch):
    """Read before the call, not after. A turn takes a minute or more and is
    charged for, so a body that could never be used must not pay for one."""

    def refuse(*_args, **_kwargs):
        raise AssertionError("a malformed body must not reach the provider")

    monkeypatch.setattr(chat_router.client, "complete_structured", refuse)

    response = draft(signed_in_client, "Hello", fields={"term": "nonsense"})

    assert response.status_code == 422


def test_a_key_belonging_to_no_field_is_dropped_rather_than_refused(
    signed_in_client, ai_turn
):
    """A browser holding a key from an earlier shape is not a bad request."""
    ai_turn(purpose="Evaluating a deal.")

    response = draft(signed_in_client, "Hello", fields={"nonsense": "x"})

    assert response.status_code == 200
    assert "nonsense" not in response.json()["fields"]


def test_a_provider_that_fails_is_reported_as_a_bad_gateway(
    signed_in_client, monkeypatch
):
    def fail(*_args, **_kwargs):
        raise client.AiError("The AI answered with nothing")

    monkeypatch.setattr(chat_router.client, "complete_structured", fail)

    response = draft(signed_in_client, "Hello")

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI answered with nothing"


def test_the_conversation_is_handed_to_the_provider(signed_in_client, monkeypatch):
    seen = {}

    def capture(messages, schema):
        seen["messages"] = messages
        return schema.model_validate({"reply": "Noted.", "fields": {}})

    monkeypatch.setattr(chat_router.client, "complete_structured", capture)

    draft(
        signed_in_client,
        "Delaware.",
        history=[{"role": "assistant", "content": "Which state's law?"}],
    )

    assert seen["messages"][-2]["content"] == "Which state's law?"
    assert seen["messages"][-1]["content"] == "Delaware."


def test_a_request_without_a_message_is_refused(signed_in_client):
    assert signed_in_client.post("/api/chat/message", json={}).status_code == 422


def test_an_empty_answer_is_asked_again_before_giving_up(signed_in_client, monkeypatch):
    """The provider returns an empty message often enough to see it in a handful
    of calls, with finish_reason "stop" rather than a truncation, so the same
    request usually succeeds on the next attempt."""
    answers = iter(["", '{"reply": "Noted.", "fields": {}}'])
    monkeypatch.setattr(client, "_ask", lambda *_args, **_kwargs: next(answers))

    response = draft(signed_in_client, "Hello")

    assert response.status_code == 200
    assert response.json()["reply"] == "Noted."


def test_an_answer_that_is_empty_twice_gives_up(signed_in_client, monkeypatch):
    monkeypatch.setattr(client, "_ask", lambda *_args, **_kwargs: "")

    response = draft(signed_in_client, "Hello")

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI answered with nothing"


def test_an_answer_that_is_not_the_shape_we_asked_for_is_reported(
    signed_in_client, monkeypatch
):
    monkeypatch.setattr(client, "_ask", lambda *_a, **_k: '{"reply": 42}')

    response = draft(signed_in_client, "Hello")

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI answer was not in the expected shape"
