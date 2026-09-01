from datetime import UTC, datetime

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import MAX_DISPLAY_NAME, MAX_EMAIL


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Email is what "the same account" means now. Display name went back to
    # being ordinary text when passwords arrived: two people may go by Ada.
    email: Mapped[str] = mapped_column(String(MAX_EMAIL), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(
        String(MAX_DISPLAY_NAME), nullable=False
    )
    # Salt and derived key, hex, separated by a dollar. See core/security.py.
    password_hash: Mapped[str] = mapped_column(String(120), nullable=False)


class Draft(Base):
    """One conversation and the agreement it is building.

    A row appears on the first turn that settles on a document, never during the
    front desk exchange that precedes it, so the library holds agreements rather
    than abandoned openings.

    `fields` and `transcript` are always reassigned whole rather than mutated in
    place, so they need no mutation tracking: every turn already carries the
    complete state, and saving it is an overwrite.
    """

    __tablename__ = "drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    document: Mapped[str] = mapped_column(String(80), nullable=False)
    fields: Mapped[dict] = mapped_column(JSON, nullable=False)
    transcript: Mapped[list] = mapped_column(JSON, nullable=False)
    # SQLite keeps no offset, so this reads back naive. It is written in UTC and
    # the browser only ever shows the date, so nothing turns on the hour.
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, default=_now, onupdate=_now
    )
