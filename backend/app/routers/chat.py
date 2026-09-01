from fastapi import APIRouter, HTTPException, status

from app.ai import chat, client
from app.core.deps import UserDep
from app.domain.nda import merge_fields
from app.domain.schemas import ChatReply, ChatRequest, GreetingReply

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/greeting", response_model=GreetingReply)
def get_greeting(_user: UserDep) -> GreetingReply:
    """Fixed text, so opening the page costs nothing at the provider."""
    return GreetingReply(reply=chat.GREETING)


@router.post("/message", response_model=ChatReply)
def post_message(payload: ChatRequest, _user: UserDep) -> ChatReply:
    """Nothing is stored. The browser holds the transcript and the fields and
    sends both, so there is no transaction open across the provider call."""
    messages = chat.build_messages(payload.fields, payload.history, payload.message)
    try:
        turn = client.complete_structured(messages, chat.ChatTurn)
    except client.AiError as cause:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(cause)) from cause

    return ChatReply(
        reply=turn.reply, fields=merge_fields(payload.fields, turn.fields)
    )
