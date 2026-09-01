"""Saved drafts: one row per conversation that settled on an agreement.

The chat is no longer stateless. What makes that safe is that a turn still
carries its whole state in the request, so saving it is an overwrite rather than
a read-modify-write: `save_turn` never merges, and two turns racing on one draft
are last write wins by row rather than a torn one.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.models import Draft, User


def list_for(session: Session, user: User) -> list[Draft]:
    """This caller's drafts, most recently worked on first."""
    return list(
        session.scalars(
            select(Draft)
            .where(Draft.owner_id == user.id)
            .order_by(Draft.updated_at.desc(), Draft.id.desc())
        )
    )


def find_owned(session: Session, user: User, draft_id: int) -> Draft | None:
    """The draft of this id belonging to this caller, or None. A draft someone
    else owns and a draft that never existed are the same answer, so nothing
    here confirms which ids exist."""
    return session.scalar(
        select(Draft).where(Draft.id == draft_id, Draft.owner_id == user.id)
    )


def save_turn(
    session: Session,
    user: User,
    draft_id: int | None,
    document: str,
    fields: dict,
    transcript: list[dict],
) -> Draft:
    """Records the outcome of one turn, opening the draft if this is the turn
    that settled on a document. Flushes; the router owns the transaction."""
    draft = find_owned(session, user, draft_id) if draft_id is not None else None
    if draft is None:
        draft = Draft(owner_id=user.id)
        session.add(draft)

    draft.document = document
    draft.fields = fields
    draft.transcript = transcript
    session.flush()
    return draft
