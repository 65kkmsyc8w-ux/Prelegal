"""The field vocabulary every document type is described in.

Six types cover every variable across the eleven Common Paper agreements. A
document declares its fields in `documents/<slug>.spec.json`; this module turns
that declaration into the Pydantic models the assistant answers in, and merges
one turn's findings into what the browser already held.

This is the generalisation of what `domain/nda.py` did for one document. The
merge rule it carried is the one thing here that is not a detail: a value the
turn did not mention leaves the held value standing.
"""

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, create_model


class FieldType(StrEnum):
    TEXT = "text"
    DATE = "date"
    MONEY = "money"
    CHOICE = "choice"
    DURATION = "duration"
    PARTY = "party"


class Party(BaseModel):
    name: str = ""
    title: str = ""
    company: str = ""
    noticeAddress: str = ""


class PartyUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    noticeAddress: str | None = None


class Duration(BaseModel):
    """A choice of mode, plus the years the mode counts in when it counts one."""

    mode: str = ""
    years: int = 1


class DurationUpdate(BaseModel):
    mode: str | None = None
    years: int | None = None


class ChoiceOption(BaseModel):
    value: str
    label: str


class DurationMode(BaseModel):
    value: str
    label: str
    countedInYears: bool = False
    # How the cover page states this mode. {years} is filled when it counts one.
    template: str


class FieldSpec(BaseModel):
    key: str
    label: str
    type: FieldType
    # What the assistant is told the field means, in the system prompt.
    prompt: str
    hint: str | None = None
    # Stands in for the value on the cover page while it is blank. Defaults to
    # the label, which is what reads correctly for almost every field.
    placeholder: str | None = None
    # Literal text to show when the field is blank, instead of a placeholder.
    # "None." on a modifications field, where blank is an answer rather than a gap.
    whenBlank: str | None = None
    # Whether the value is substituted into the clause text as {key}, rather
    # than only appearing on the cover page.
    inline: bool = False
    options: list[ChoiceOption] = []
    modes: list[DurationMode] = []

    @property
    def stands_in_as(self) -> str:
        return self.placeholder or self.label


# The two field types whose value is an object rather than a string, and the
# pair of models each needs: the complete shape, and the all-optional shape one
# turn reports into.
_NESTED: dict[FieldType, tuple[type[BaseModel], type[BaseModel]]] = {
    FieldType.PARTY: (Party, PartyUpdate),
    FieldType.DURATION: (Duration, DurationUpdate),
}


def _held_type(field: FieldSpec) -> tuple[Any, Any]:
    if field.type is FieldType.PARTY:
        return Party, Party()
    if field.type is FieldType.DURATION:
        return Duration, Duration(mode=field.modes[0].value)
    if field.type is FieldType.CHOICE:
        values = tuple(option.value for option in field.options)
        return Literal[values], values[0]
    return str, ""


def _found_type(field: FieldSpec) -> tuple[Any, Any]:
    if field.type in _NESTED:
        update = _NESTED[field.type][1]
        return update, update()
    if field.type is FieldType.CHOICE:
        values = tuple(option.value for option in field.options)
        return Literal[values] | None, None
    return str | None, None


def _model_name(slug: str, suffix: str) -> str:
    return "".join(part.title() for part in slug.split("-")) + suffix


def details_model(slug: str, fields: list[FieldSpec]) -> type[BaseModel]:
    """The complete shape of a document's cover page, every field defaulted."""
    return create_model(
        _model_name(slug, "Details"),
        **{field.key: _held_type(field) for field in fields},
    )


def update_model(slug: str, fields: list[FieldSpec]) -> type[BaseModel]:
    """What the assistant took from one message. None means the message did not
    mention the field, never that it should be cleared."""
    return create_model(
        _model_name(slug, "FieldsUpdate"),
        **{field.key: _found_type(field) for field in fields},
    )


def _overlay(base: dict, patch: dict) -> dict:
    return {
        **base,
        **{
            key: value
            for key, value in patch.items()
            if value is not None and value != ""
        },
    }


def merge_fields(fields: list[FieldSpec], current: dict, found: dict) -> dict:
    """Lays what the assistant found over what the browser already had. The one
    place a missing value is read as "not mentioned", so a turn that says
    nothing about a field leaves it standing.

    An empty string counts as missing, not as an instruction to clear. The model
    is asked to leave untouched fields null and often does not: it echoes values
    back, which merges to the same answer, and it fills fields it knows nothing
    about with "", which without this would wipe them. The cost is that nothing
    the assistant says can empty a field once it is set, only replace it.

    Object fields merge a level down, so one detail of a party arriving does not
    wipe the rest of that party, and neither party disturbs the other.
    """
    merged = _overlay(current, found)
    for field in fields:
        if field.type in _NESTED and isinstance(found.get(field.key), dict):
            merged[field.key] = _overlay(current[field.key], found[field.key])
    return merged
