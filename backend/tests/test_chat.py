from app.ai import client
from app.ai.chat import GREETING, ChatTurn
from app.routers import chat as chat_router


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


def test_a_reply_carries_what_the_assistant_found(signed_in_client, ai_turn):
    ai_turn(reply="Which state's law?", purpose="Evaluating a deal.")

    body = signed_in_client.post(
        "/api/chat/message", json={"message": "We want to evaluate a deal."}
    ).json()

    assert body["reply"] == "Which state's law?"
    assert body["fields"]["purpose"] == "Evaluating a deal."


def test_a_turn_that_says_nothing_of_a_field_leaves_it_standing(
    signed_in_client, ai_turn
):
    ai_turn(jurisdiction="New Castle, DE")

    body = signed_in_client.post(
        "/api/chat/message",
        json={
            "message": "The courts in New Castle.",
            "fields": {"governingLaw": "Delaware"},
        },
    ).json()

    assert body["fields"]["governingLaw"] == "Delaware"
    assert body["fields"]["jurisdiction"] == "New Castle, DE"


def test_the_parties_are_gathered_over_several_turns(signed_in_client, ai_turn):
    ai_turn(partyTwo={"company": "Beta Ltd"})

    body = signed_in_client.post(
        "/api/chat/message",
        json={
            "message": "The other side is Beta Ltd.",
            "fields": {"partyOne": {"company": "Acme Inc"}},
        },
    ).json()

    assert body["fields"]["partyOne"]["company"] == "Acme Inc"
    assert body["fields"]["partyTwo"]["company"] == "Beta Ltd"


def test_the_whole_cover_page_comes_back_however_little_changed(
    signed_in_client, ai_turn
):
    """The browser replaces its state with this wholesale, so it has to be
    complete rather than a patch."""
    ai_turn(purpose="Evaluating a deal.")

    fields = signed_in_client.post(
        "/api/chat/message", json={"message": "Evaluating a deal."}
    ).json()["fields"]

    assert fields["termKind"] == "expires"
    assert fields["partyOne"] == {
        "name": "",
        "title": "",
        "company": "",
        "noticeAddress": "",
    }


def test_a_message_of_nothing_but_spaces_is_refused(signed_in_client):
    response = signed_in_client.post("/api/chat/message", json={"message": "   "})

    assert response.status_code == 422


def test_a_provider_that_fails_is_reported_as_a_bad_gateway(
    signed_in_client, monkeypatch
):
    def fail(*_args, **_kwargs):
        raise client.AiError("The AI answered with nothing")

    monkeypatch.setattr(chat_router.client, "complete_structured", fail)

    response = signed_in_client.post("/api/chat/message", json={"message": "Hello"})

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI answered with nothing"


def test_the_conversation_is_handed_to_the_provider(signed_in_client, monkeypatch):
    seen = {}

    def capture(messages, _schema):
        seen["messages"] = messages
        return ChatTurn(reply="Noted.", fields={})

    monkeypatch.setattr(chat_router.client, "complete_structured", capture)

    signed_in_client.post(
        "/api/chat/message",
        json={
            "message": "Delaware.",
            "history": [{"role": "assistant", "content": "Which state's law?"}],
        },
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

    response = signed_in_client.post("/api/chat/message", json={"message": "Hello"})

    assert response.status_code == 200
    assert response.json()["reply"] == "Noted."


def test_an_answer_that_is_empty_twice_gives_up(signed_in_client, monkeypatch):
    monkeypatch.setattr(client, "_ask", lambda *_args, **_kwargs: "")

    response = signed_in_client.post("/api/chat/message", json={"message": "Hello"})

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI answered with nothing"


def test_an_answer_that_is_not_the_shape_we_asked_for_is_reported(
    signed_in_client, monkeypatch
):
    monkeypatch.setattr(client, "_ask", lambda *_a, **_k: '{"reply": 42}')

    response = signed_in_client.post("/api/chat/message", json={"message": "Hello"})

    assert response.status_code == 502
    assert response.json()["detail"] == "The AI answer was not in the expected shape"
