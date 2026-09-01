from fastapi import APIRouter, HTTPException, status

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
    browser has not seen yet arrives missing and comes back defaulted."""
    return details_model(spec.slug, spec.fields).model_validate(fields).model_dump()


@router.post("/message", response_model=ChatReply)
def post_message(payload: ChatRequest, _user: UserDep) -> ChatReply:
    """Nothing is stored. The browser holds the transcript, the document and the
    fields and sends all three, so there is no transaction open across the
    provider call."""
    spec = documents.resolve(payload.document)
    messages = chat.build_messages(
        spec, payload.fields, payload.history, payload.message
    )
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
        fields=merge_fields(
            spec.fields, _held(spec, payload.fields), turn.fields.model_dump()
        ),
    )
