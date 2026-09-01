from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import MAX_DISPLAY_NAME


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Unique because signing in twice under one name is the same person coming
    # back, not a second account. sign_in relies on it.
    display_name: Mapped[str] = mapped_column(
        String(MAX_DISPLAY_NAME), unique=True, nullable=False
    )
