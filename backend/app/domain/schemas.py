from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import MAX_CHAT_MESSAGE, MAX_DISPLAY_NAME
from app.domain.documents import DocumentSpec
from app.domain.fields import FieldSpec


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


class DocumentOut(BaseModel):
    """A document's declaration, without its terms.

    The browser is sent this so it can render a cover page it was never taught
    the shape of. The terms are left out: it already has them, generated from
    the same templates, and the longer agreements would put several thousand
    words on the wire every turn for nothing.
    """

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    shortName: str
    description: str
    source: str
    preamble: str
    coverPageHeading: str
    termsHeading: str
    closing: str
    attribution: str
    fields: list[FieldSpec]

    @classmethod
    def of(cls, spec: DocumentSpec) -> "DocumentOut":
        return cls.model_validate(spec)


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE)
    history: list[ChatEntry] = []
    # The document being drafted, once one is settled on. Null until then.
    document: str | None = None
    # Shaped by `document`, so it is only meaningful alongside one. The domain
    # layer validates it against that document once the slug resolves.
    fields: dict[str, Any] = {}


class ChatReply(BaseModel):
    reply: str
    document: str | None = None
    # The document's own declaration, sent so the browser can render a cover
    # page it was never taught the shape of. This is what replaces the hand
    # mirrored pair the one document type needed.
    documentSpec: DocumentOut | None = None
    fields: dict[str, Any] = {}


class GreetingReply(BaseModel):
    reply: str
