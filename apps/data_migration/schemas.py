from datetime import datetime
from typing import Any
from uuid import UUID

from ninja import Schema
from pydantic import Field


class PreviewIn(Schema):
    overrides: list[dict[str, Any]] = Field(default_factory=list)
    mappings: list[dict[str, Any]] = Field(default_factory=list)
    member_mappings: dict[str, int] = Field(default_factory=dict)


class ConfirmIn(Schema):
    preview_version: str


class AssetRetryIn(Schema):
    source_url: str | None = None
    media_id: int | None = None


class BatchOut(Schema):
    id: UUID
    source_team_name: str
    source_team_id: str
    status: str
    media_status: str
    created_at: datetime
    updated_at: datetime
    error_message: str
    summary: dict[str, int]
    media_summary: dict[str, int]
    preview: dict[str, Any]

    @staticmethod
    def resolve_media_summary(obj):
        from apps.data_migration.services import media_summary

        return media_summary(obj)


class RecordOut(Schema):
    id: int
    batch_id: UUID
    entity_type: str
    source_id: str
    data: dict[str, Any]
    state: str
    error_message: str
    target_type: str
    target_id: int | None
    source_deleted: bool
    source_created_at: str
    source_updated_at: str
    media: list[dict[str, Any]] = Field(default_factory=list)

    @staticmethod
    def resolve_media(obj):
        from apps.data_migration.presentation import archive_media_for

        return archive_media_for(obj)


class AssetOut(Schema):
    id: UUID
    status: str
    source_url: str
    resource_type: str
    media_type: str
    error_message: str
    attempts: int
    media_file_id: int | None
    binding_state: str = ""
    url: str | None = None

    @staticmethod
    def resolve_url(obj):
        from apps.data_migration.presentation import display_url

        return display_url(obj)

    @staticmethod
    def resolve_binding_state(obj):
        if obj.bindings.filter(state="detached").exists():
            return "detached"
        return ""
