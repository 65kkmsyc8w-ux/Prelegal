from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)

from app.core.config import (
    MAX_CHAT_MESSAGE,
    MAX_DISPLAY_NAME,
    MAX_EMAIL,
    MAX_PASSWORD,
    MIN_PASSWORD,
)
from app.domain.documents import DocumentSpec
from app.domain.fields import FieldSpec

# Trimmed and lower cased, because an address typed with a stray space or a
# capital is the same account. The password is deliberately not trimmed: it is
# stored and compared exactly as typed, and stripping it in one place and not
# the other would lock out anyone whose password ends in a space.
Email = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_lower=True, min_length=3, max_length=MAX_EMAIL
    ),
]
DisplayName = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=MAX_DISPLAY_NAME
    ),
]
Password = Annotated[
    str, StringConstraints(min_length=MIN_PASSWORD, max_length=MAX_PASSWORD)
]


class SignUpRequest(BaseModel):
    email: Email
    display_name: DisplayName
    password: Password

    @field_validator("email")
    @classmethod
    def _shaped_like_an_address(cls, value: str) -> str:
        """Deliberately not EmailStr: that needs the email-validator package,
        and nothing here posts mail. This is what stops a display name being
        typed into the address box."""
        local, _, domain = value.partition("@")
        if not local or "." not in domain or domain.endswith("."):
            raise ValueError("Enter an email address")
        return value


class SignInRequest(BaseModel):
    # Neither field is shape checked. An address nobody could have registered is
    # a failed sign in like any other, not a 422 that says so.
    email: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, to_lower=True, min_length=1, max_length=MAX_EMAIL
        ),
    ]
    password: Annotated[str, StringConstraints(min_length=1, max_length=MAX_PASSWORD)]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
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


class DraftSummary(BaseModel):
    """One card in the library. The title is resolved here rather than in the
    browser, which knows a slug but not what it is called."""

    id: int
    document: str
    title: str
    updatedAt: datetime


class DraftDetail(BaseModel):
    """Everything needed to pick a conversation back up: what was said, what was
    gathered, and the declaration to render it with."""

    id: int
    document: str
    documentSpec: DocumentOut
    fields: dict[str, Any]
    transcript: list[ChatEntry]
    updatedAt: datetime


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=MAX_CHAT_MESSAGE)
    history: list[ChatEntry] = []
    # The document being drafted, once one is settled on. Null until then.
    document: str | None = None
    # Shaped by `document`, so it is only meaningful alongside one. The domain
    # layer validates it against that document once the slug resolves.
    fields: dict[str, Any] = {}
    # The draft this turn belongs to, once one has been opened. The server mints
    # it; the browser only carries it back.
    draftId: int | None = None


class ChatReply(BaseModel):
    reply: str
    document: str | None = None
    # The document's own declaration, sent so the browser can render a cover
    # page it was never taught the shape of. This is what replaces the hand
    # mirrored pair the one document type needed.
    documentSpec: DocumentOut | None = None
    fields: dict[str, Any] = {}
    # Null until a document is settled on, because nothing is saved before then.
    draftId: int | None = None


class GreetingReply(BaseModel):
    reply: str
