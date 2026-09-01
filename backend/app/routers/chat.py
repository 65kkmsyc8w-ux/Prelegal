from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError

from app.ai import chat, client
from app.core.deps import UserDep
from app.domain import documents
from app.domain.documents import DocumentSpec
from app.domain.fields import details_model, merge_fields
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


@router.post("/message", response_model=ChatReply)
def post_message(payload: ChatRequest, _user: UserDep) -> ChatReply:
    """Nothing is stored. The browser holds the transcript, the document and the
    fields and sends all three, so there is no transaction open across the
    provider call."""
    spec = documents.resolve(payload.document)
    held = _held(spec, payload.fields) if spec else {}
    messages = chat.build_messages(spec, held, payload.history, payload.message)
    try:
        turn = client.complete_structured(messages, chat.turn_schema(spec))
    except client.AiError as cause:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(cause)) from cause

    # A slug the assistant invented names no document, and means the same thing
    # as naming none: carry on with whatever was already being drafted.
    chosen = documents.resolve(turn.document) or spec
    if chosen is None:
        return ChatReply(reply=turn.reply)

    if spec is None or chosen.slug != spec.slug:
        # A document has just been settled on, or swapped for another. Field
        # keys belong to the document they were gathered for, so none carry over.
        return ChatReply(
            reply=turn.reply,
            document=chosen.slug,
            documentSpec=DocumentOut.of(chosen),
            fields=_blank(chosen),
        )

    return ChatReply(
        reply=turn.reply,
        document=spec.slug,
        documentSpec=DocumentOut.of(spec),
        fields=merge_fields(spec.fields, held, turn.fields.model_dump()),
    )
