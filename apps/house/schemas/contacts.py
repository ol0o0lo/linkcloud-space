from __future__ import annotations

from datetime import datetime
from typing import Literal

from ninja import Schema
from pydantic import ConfigDict, Field

from apps.house.constants import ContactRole


class ContactIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str
    phone: str
    email: str = ""
    roles: list[str] = Field(default_factory=list)
    notes: str = ""
    is_active: bool = True


class ContactPatchIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    phone: str | None = None
    email: str | None = None
    roles: list[str] | None = None
    notes: str | None = None
    is_active: bool | None = None


class ContactOut(Schema):
    id: int
    name: str
    phone: str
    email: str
    roles: list[str]
    roles__mapping: list[str]
    user_id: int | None
    public_key: str | None
    landlord_binding_status: Literal["unbound", "invited", "bound"] | None
    landlord_invite_expires_at: datetime | None
    notes: str
    is_active: bool

    @staticmethod
    def resolve_roles__mapping(obj):
        return [ContactRole.get_choice_label(role) for role in (obj.roles or [])]

    @staticmethod
    def resolve_public_key(obj):
        return str(obj.public_key) if obj.public_key else None
