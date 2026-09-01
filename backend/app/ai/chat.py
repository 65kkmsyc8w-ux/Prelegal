from pydantic import BaseModel, create_model

from app.core import config
from app.domain import documents
from app.domain.documents import DocumentSpec
from app.domain.fields import FieldSpec, FieldType, update_model
from app.domain.schemas import ChatEntry

GREETING = (
    "Tell me what kind of agreement you need and I will help you put it "
    "together. If we cannot draft the one you have in mind, I will say so and "
    "suggest the closest one we can."
)

# Before a document is settled on, the assistant is working out which of the
# eleven is wanted. It answers with a slug or with nothing, and the router
# treats anything it does not recognise as nothing.
FRONT_DESK_PROMPT = """You help someone choose which legal agreement to draft, from the ones we can draft. These are all of them:

{listing}

Work out which one fits what they describe, and say which you think it is and why in one short paragraph.

If they ask for an agreement that is not on the list, say plainly that we cannot draft that one, name the closest one we can, and explain in one sentence why it is the nearest fit. Do not offer to draft anything that is not on the list.

Set document to the slug only once it is settled: either they asked for one of ours, or they agreed to the one you offered instead. While it is still open, leave document null.

Never write any agreement text yourself. Never use emojis."""

DRAFTING_PROMPT = """You help someone draft a Common Paper {title} by talking to them.

Ask about the agreement one or two points at a time, in plain language, and never all at once. Do not ask again for something already known. Never write the agreement text yourself: the document is built from the fields beside you, and your reply is only your side of the conversation, one short paragraph at most. Never use emojis.

The cover page needs all of this:
{fields}

Take every value a message gives you, even several at once, and even ones you did not ask for. A message naming both the law and the courts fills in both.

Set a field only when the latest message gives or changes its value. Leave every other field null, so something already established is never overwritten by silence. Never invent a value nobody gave you.

Once every field above is known, say so, and tell them they can download the agreement.

If they say they want a different agreement instead, set document to that one's slug. These are the ones we can draft:
{listing}

These are the terms this agreement incorporates, so you can answer questions about it:
{clauses}"""


def _field_line(field: FieldSpec) -> str:
    line = f"- {field.key}: {field.prompt}"
    if field.type is FieldType.CHOICE:
        allowed = ", ".join(f'"{option.value}"' for option in field.options)
        return f"{line}. One of {allowed}"
    if field.type is FieldType.DURATION:
        allowed = ", ".join(f'"{mode.value}"' for mode in field.modes)
        counted = ", and years when it counts a number of years"
        return f'{line}. Give it as {{"mode": one of {allowed}{counted}}}'
    if field.type is FieldType.PARTY:
        return f'{line}. Give it as {{"company", "name", "title", "noticeAddress"}}'
    return line


def _clause_lines(spec: DocumentSpec) -> str:
    return "\n".join(
        f"{clause.number} {clause.heading}" for clause in spec.clauses
    )


def build_prompt(spec: DocumentSpec | None) -> str:
    """The front desk while the document is still open, and the drafting prompt
    for a document once one is settled."""
    if spec is None:
        return FRONT_DESK_PROMPT.format(listing=documents.listing())
    return DRAFTING_PROMPT.format(
        title=spec.title,
        fields="\n".join(_field_line(field) for field in spec.fields),
        listing=documents.listing(),
        clauses=_clause_lines(spec),
    )


class FrontDeskTurn(BaseModel):
    reply: str
    document: str | None = None


def turn_schema(spec: DocumentSpec | None) -> type[BaseModel]:
    """What the assistant answers in. Before a document is settled it names one;
    afterwards it also reports whatever the last message gave."""
    if spec is None:
        return FrontDeskTurn
    fields = update_model(spec.slug, spec.fields)
    return create_model(
        "".join(part.title() for part in spec.slug.split("-")) + "Turn",
        reply=(str, ...),
        document=(str | None, None),
        fields=(fields, fields()),
    )


def build_messages(
    spec: DocumentSpec | None,
    fields: dict,
    history: list[ChatEntry],
    message: str,
) -> list[dict[str, str]]:
    known = [] if spec is None else [
        {
            "role": "system",
            "content": f"Fields already established: {fields}",
        }
    ]
    return [
        {"role": "system", "content": build_prompt(spec)},
        *known,
        *(
            {"role": entry.role, "content": entry.content}
            for entry in history[-config.MAX_CHAT_HISTORY :]
        ),
        {"role": "user", "content": message},
    ]
