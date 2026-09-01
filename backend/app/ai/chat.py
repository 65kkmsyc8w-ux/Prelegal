from pydantic import BaseModel

from app.core import config
from app.domain.nda import NdaDetails, NdaFieldsUpdate
from app.domain.schemas import ChatEntry

GREETING = (
    "Let's put together your Mutual NDA. Tell me what the agreement is for and "
    "who the two companies are, and I will ask about the rest as we go."
)

# The eleven Standard Terms, transcribed by hand from templates/mutual-nda.md,
# the same way frontend/src/content/standard-terms.ts is. Nothing reads the
# template at runtime and it is not copied into the image; test_chat_prompt.py
# pins the list so an edit cannot quietly drop one.
CLAUSES = """1 Introduction. What counts as Confidential Information.
2 Use and Protection of Confidential Information. It may be used only for the Purpose.
3 Exceptions. Information already public, already known, or independently developed.
4 Disclosures Required by Law. Notice before disclosing under a legal order.
5 Term and Termination. The MNDA runs from the Effective Date for the MNDA Term.
6 Return or Destruction of Confidential Information. On request or at the end.
7 Proprietary Rights. Disclosure grants no licence.
8 Disclaimer. Confidential Information comes as is, with no warranty.
9 Governing Law and Jurisdiction. Named on the cover page.
10 Equitable Relief. Breach may be met with an injunction.
11 General. Assignment, notices, and the whole agreement."""

SYSTEM_PROMPT = f"""You help someone draft a Common Paper Mutual Non-Disclosure Agreement by talking to them.

Ask about the agreement one or two points at a time, in plain language, and never all at once. Do not ask again for something already known. Never write the agreement text yourself: the document is built from the fields beside you, and your reply is only your side of the conversation, one short paragraph at most. Never use emojis.

The cover page needs all of this:
- purpose: what the parties will use each other's confidential information for
- effectiveDate: the date it takes effect, as yyyy-mm-dd
- termKind: "expires" after a set number of years, or "untilTerminated"
- termYears: how many years, when it expires
- confidentialityKind: confidentiality lasts a number of "years", or is "perpetual"
- confidentialityYears: how many years, when it is not perpetual
- governingLaw: the state whose law governs
- jurisdiction: the city or county and state whose courts hear disputes
- modifications: any change to the standard terms, otherwise leave it alone
- partyOne and partyTwo: each with company, name and title of whoever signs, and noticeAddress

Take every value a message gives you, even several at once, and even ones you did not ask for. A message naming both the law and the courts fills in both.

Set a field only when the latest message gives or changes its value. Leave every other field null, so something already established is never overwritten by silence. Never invent a value nobody gave you.

Once every field above is known, say so, and tell them they can download the agreement.

These are the standard terms the agreement incorporates, so you can answer questions about it:
{CLAUSES}"""


class ChatTurn(BaseModel):
    reply: str
    fields: NdaFieldsUpdate


def build_messages(
    fields: NdaDetails, history: list[ChatEntry], message: str
) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": f"Fields already established: {fields.model_dump_json()}",
        },
        *(
            {"role": entry.role, "content": entry.content}
            for entry in history[-config.MAX_CHAT_HISTORY :]
        ),
        {"role": "user", "content": message},
    ]
