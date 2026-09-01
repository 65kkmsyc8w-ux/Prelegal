from typing import Literal

from pydantic import BaseModel

TermKind = Literal["expires", "untilTerminated"]
ConfidentialityKind = Literal["years", "perpetual"]


class Party(BaseModel):
    name: str = ""
    title: str = ""
    company: str = ""
    noticeAddress: str = ""


class NdaDetails(BaseModel):
    """The cover page of a Common Paper Mutual NDA, in the shape the browser
    already holds. Transcribed by hand from frontend/src/lib/nda.ts, the same
    way content/standard-terms.ts is transcribed from templates/mutual-nda.md.
    The two have to be changed together.
    """

    purpose: str = ""
    effectiveDate: str = ""
    termKind: TermKind = "expires"
    termYears: int = 1
    confidentialityKind: ConfidentialityKind = "years"
    confidentialityYears: int = 1
    governingLaw: str = ""
    jurisdiction: str = ""
    modifications: str = ""
    partyOne: Party = Party()
    partyTwo: Party = Party()


class PartyUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    noticeAddress: str | None = None


class NdaFieldsUpdate(BaseModel):
    """What the assistant took from one message. None means the message did not
    mention the field, never that it should be cleared."""

    purpose: str | None = None
    effectiveDate: str | None = None
    termKind: TermKind | None = None
    termYears: int | None = None
    confidentialityKind: ConfidentialityKind | None = None
    confidentialityYears: int | None = None
    governingLaw: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    partyOne: PartyUpdate = PartyUpdate()
    partyTwo: PartyUpdate = PartyUpdate()


def _overlay(base: dict, patch: dict) -> dict:
    return {**base, **{key: value for key, value in patch.items() if value is not None}}


def merge_fields(current: NdaDetails, update: NdaFieldsUpdate) -> NdaDetails:
    """Lays what the assistant found over what the browser already had. The one
    place None is read as "not mentioned", so a turn that says nothing about a
    field leaves it standing. The model is asked to leave untouched fields null
    but often echoes them back instead, which merges to the same answer.
    """
    held = current.model_dump()
    found = update.model_dump()
    merged = _overlay(held, found)
    merged["partyOne"] = _overlay(held["partyOne"], found["partyOne"])
    merged["partyTwo"] = _overlay(held["partyTwo"], found["partyTwo"])
    return NdaDetails.model_validate(merged)
