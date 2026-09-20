from datetime import datetime
from typing import Literal

from ninja import Schema
from pydantic import Field


class ConversationCreateIn(Schema):
    scope: Literal["personal", "organization"] = "organization"


class ConversationOut(Schema):
    id: int
    organization_id: int | None
    capability: str
    title: str
    status: str
    last_message_at: datetime | None
    created_at: datetime


class MessageCreateIn(Schema):
    content: str = Field(..., min_length=1, max_length=20_000)
    idempotency_key: str = Field(..., min_length=1, max_length=128)


class MessageOut(Schema):
    id: int
    role: str
    content: str
    content_json: dict | list | None
    invocation_id: int | None
    created_at: datetime


class MessageGenerationOut(Schema):
    invocation_id: int
    message: MessageOut
