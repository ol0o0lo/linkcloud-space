from datetime import datetime
from typing import Any

from ninja import Schema
from pydantic import Field


class FavoriteDisplayFactOut(Schema):
    label: str
    value: str


class FavoriteTargetDisplayOut(Schema):
    title: str
    subtitle: str = ""
    cover_url: str | None = None
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    facts: list[FavoriteDisplayFactOut] = Field(default_factory=list)


class FavoriteOut(Schema):
    id: int
    target_type: str
    target_id: str
    created_at: datetime
    available: bool
    display: FavoriteTargetDisplayOut | None
    target: dict[str, Any] | None


class FavoriteTargetTypeOut(Schema):
    target_type: str
    display_name: str
    order: int
    favorite_count: int
