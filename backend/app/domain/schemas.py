from pydantic import BaseModel, ConfigDict, Field

from app.core.config import MAX_DISPLAY_NAME


class SessionRequest(BaseModel):
    # Stripped before the length check, so a name of nothing but spaces is
    # refused rather than opening an account with a blank name.
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str = Field(min_length=1, max_length=MAX_DISPLAY_NAME)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
