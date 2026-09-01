from litellm import completion
from pydantic import BaseModel, ValidationError

from app.core import config

# Cerebras is asked for first, per the project's Cerebras skill. OpenRouter
# treats the order as a preference: the configured model is served by Nvidia in
# practice, and the call falls back to it rather than failing.
#
# Reasoning goes through extra_body rather than litellm's reasoning_effort
# argument, which the skill uses. litellm refuses that argument for this model
# ("openrouter does not support parameters: ['reasoning_effort']") and the call
# never leaves the process. Sent this way it reaches OpenRouter untouched, and
# it is not optional: without it the reasoning runs to the token limit and the
# answer comes back empty.
EXTRA_BODY = {
    "provider": {"order": ["cerebras"]},
    "reasoning": {"effort": "low"},
}

# The model reasons before it writes, and the reasoning comes out of the same
# budget as the answer. A budget of 4000 returned finish_reason "length" with no
# content at all; a turn of this shape spends 2000 to 3000 tokens once it does
# answer. Measured against the real provider, as is the timeout: turns took
# between 30 and 150 seconds.
MAX_TOKENS = 16000
TIMEOUT = 180.0

# The model sometimes answers with an empty message and finish_reason "stop",
# having spent a couple of hundred tokens reasoning and written nothing. It is
# not truncation, so a larger budget does not prevent it, and the same request
# succeeds on the next attempt. Seen repeatedly against the real provider.
ATTEMPTS = 2


class AiError(Exception):
    pass


def _ask(messages: list[dict[str, str]], schema: type[BaseModel]) -> str:
    try:
        response = completion(
            model=f"openrouter/{config.OPENROUTER_MODEL}",
            messages=messages,
            response_format=schema,
            extra_body=EXTRA_BODY,
            max_tokens=MAX_TOKENS,
            timeout=TIMEOUT,
        )
    except Exception as cause:
        raise AiError("Could not reach the AI provider") from cause
    return response.choices[0].message.content or ""


def complete_structured[Schema: BaseModel](
    messages: list[dict[str, str]], schema: type[Schema]
) -> Schema:
    for _ in range(ATTEMPTS):
        content = _ask(messages, schema)
        if content:
            try:
                return schema.model_validate_json(content)
            except ValidationError as cause:
                raise AiError("The AI answer was not in the expected shape") from cause

    raise AiError("The AI answered with nothing")
