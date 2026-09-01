from fastapi import APIRouter, HTTPException, status

from app.core.deps import SessionDep, UserDep
from app.domain import documents, drafts
from app.domain.schemas import DocumentOut, DraftDetail, DraftSummary

router = APIRouter(prefix="/api/drafts", tags=["drafts"])


@router.get("", response_model=list[DraftSummary])
def get_drafts(user: UserDep, session: SessionDep) -> list[DraftSummary]:
    """The caller's library. Titles are resolved from the declarations already
    in memory, so listing is one query however many drafts there are."""
    return [
        DraftSummary(
            id=draft.id,
            document=draft.document,
            title=documents.DOCUMENTS[draft.document].title,
            updatedAt=draft.updated_at,
        )
        for draft in drafts.list_for(session, user)
    ]


@router.get("/{draft_id}", response_model=DraftDetail)
def get_draft(draft_id: int, user: UserDep, session: SessionDep) -> DraftDetail:
    draft = drafts.find_owned(session, user, draft_id)
    if draft is None:
        # A draft belonging to someone else answers the same as one that never
        # existed, so nothing here confirms which ids are real.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such draft")

    spec = documents.DOCUMENTS[draft.document]
    return DraftDetail(
        id=draft.id,
        document=draft.document,
        documentSpec=DocumentOut.of(spec),
        fields=draft.fields,
        transcript=draft.transcript,
        updatedAt=draft.updated_at,
    )
