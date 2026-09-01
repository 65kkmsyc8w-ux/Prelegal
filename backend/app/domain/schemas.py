from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import MAX_CHAT_MESSAGE, MAX_DISPLAY_NAME
from app.domain.nda import NdaDetails


class SessionRequest(BaseModel):
    # Stripped before the length check, so a name of nothing but spaces is
    # refused rather than opening an account with a blank name.
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str = Field(min_length=1, max_length=MAX_DISPLAY_NAME)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str


class ChatEntry(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE)
    history: list[ChatEntry] = []
    fields: NdaDetails = NdaDetails()


class ChatReply(BaseModel):
    reply: str
    fields: NdaDetails


class GreetingReply(BaseModel):
    reply: str
