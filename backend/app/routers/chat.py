from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.ai import chat, client
from app.core.deps import SessionDep, UserDep
from app.domain import documents, drafts
from app.domain.documents import DocumentSpec
from app.domain.fields import details_model, merge_fields
from app.domain.models import User
from app.domain.schemas import (
    ChatReply,
    ChatRequest,
    DocumentOut,
    GreetingReply,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/greeting", response_model=GreetingReply)
def get_greeting(_user: UserDep) -> GreetingReply:
    """Fixed text, so opening the page costs nothing at the provider."""
    return GreetingReply(reply=chat.GREETING)


def _blank(spec: DocumentSpec) -> dict:
    return details_model(spec.slug, spec.fields)().model_dump()


def _held(spec: DocumentSpec, fields: dict) -> dict:
    """What the browser sent, read as the document's own shape. A field the
    browser has not seen yet arrives missing and comes back defaulted, and a key
    belonging to no field is dropped.

    Read before the provider is called rather than after. A body that is not the
    shape the document takes is the caller's mistake, and answering 422 for it
    costs nothing; finding out after the call would mean a minute or more of
    waiting and a charge for an answer that could not be used.
    """
    try:
        return details_model(spec.slug, spec.fields).model_validate(fields).model_dump()
    except ValidationError as cause:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Those fields are not the shape a {spec.title} takes",
        ) from cause


def _owned(session: Session, user: User, draft_id: int | None) -> None:
    """Refuses a draft this caller cannot write to, for the same reason the
    fields are checked here: before the provider is called, so a stale tab costs
    a 404 rather than a minute of waiting and a charge."""
    if draft_id is not None and drafts.find_owned(session, user, draft_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such draft")


@router.post("/message", response_model=ChatReply)
def post_message(
    payload: ChatRequest, user: UserDep, session: SessionDep
) -> ChatReply:
    """One turn: everything that can be refused for free is refused first, then
    the provider is asked, then the outcome is saved."""
    spec = documents.resolve(payload.document)
    held = _held(spec, payload.fields) if spec else {}
    _owned(session, user, payload.draftId)

    # Nothing has been written, but resolving the caller and checking the draft
    # both read, and a SELECT alone opens a transaction that holds SQLite's
    # shared lock until it is closed. The provider call takes 30 to 150 seconds,
    # and any other request wanting to commit in that window would wait out the
    # busy timeout and fail. Closing it here is what keeps no transaction open
    # across the round trip now that this route writes at all.
    session.commit()

    messages = chat.build_messages(spec, held, payload.history, payload.message)
    try:
        turn = client.complete_structured(messages, chat.turn_schema(spec))
    except client.AiError as cause:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(cause)) from cause

    # A slug the assistant invented names no document, and means the same thing
    # as naming none: carry on with whatever was already being drafted.
    chosen = documents.resolve(turn.document) or spec
    if chosen is None:
        # Still at the front desk. Nothing is saved until an agreement is
        # settled on, so the library holds drafts rather than abandoned
        # openings.
        return ChatReply(reply=turn.reply)

    if spec is None or chosen.slug != spec.slug:
        # A document has just been settled on, or swapped for another. Field
        # keys belong to the document they were gathered for, so none carry over.
        fields = _blank(chosen)
    else:
        fields = merge_fields(spec.fields, held, turn.fields.model_dump())

    transcript = [
        *(entry.model_dump() for entry in payload.history),
        {"role": "user", "content": payload.message},
        {"role": "assistant", "content": turn.reply},
    ]
    draft = drafts.save_turn(
        session, user, payload.draftId, chosen.slug, fields, transcript
    )
    session.commit()

    return ChatReply(
        reply=turn.reply,
        document=chosen.slug,
        documentSpec=DocumentOut.of(chosen),
        fields=fields,
        draftId=draft.id,
    )
