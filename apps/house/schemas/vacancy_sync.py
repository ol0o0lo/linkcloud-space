from __future__ import annotations

from decimal import Decimal
from typing import Literal

from ninja import Schema
from pydantic import ConfigDict, Field


class VacancySyncBuildingOverrideIn(Schema):
    block_index: int = Field(..., ge=0)
    building_id: int = Field(..., gt=0)


class VacancySyncIn(Schema):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["preview", "apply"] = "preview"
    raw_text: str
    building_overrides: list[VacancySyncBuildingOverrideIn] = Field(default_factory=list)
    ignored_lines: list[int] = Field(default_factory=list)
    plan_hash: str | None = None


class VacancySyncErrorOut(Schema):
    code: str
    message: str
    block_index: int | None
    line_number: int | None


class VacancySyncLineOut(Schema):
    line_number: int
    raw: str
    status: Literal["valid", "error", "ignored"]
    error_code: str | None
    message: str | None
    room_number: str | None
    floor: int | None
    asking_rent: Decimal | None
    bedrooms: int | None
    living_rooms: int | None
    tags: list[str]


class VacancySyncBuildingCandidateOut(Schema):
    id: int
    name: str
    address: str


class VacancySyncBuildingMatchOut(Schema):
    status: Literal["matched", "overridden", "ambiguous", "new", "created"]
    building_id: int | None
    name: str | None
    address: str
    candidates: list[VacancySyncBuildingCandidateOut]


class VacancySyncHouseChangeOut(Schema):
    house_id: int | None
    room_number: str
    before_status: str | None
    after_status: str | None
    changed_fields: list[str]


class VacancySyncChangesOut(Schema):
    create_houses: list[VacancySyncHouseChangeOut]
    update_houses: list[VacancySyncHouseChangeOut]
    mark_vacant: list[VacancySyncHouseChangeOut]
    mark_rented: list[VacancySyncHouseChangeOut]
    preserve_special_status: list[VacancySyncHouseChangeOut]
    inactive_conflicts: list[VacancySyncHouseChangeOut]


class VacancySyncBlockOut(Schema):
    block_index: int
    address: str
    building_match: VacancySyncBuildingMatchOut
    lines: list[VacancySyncLineOut]
    changes: VacancySyncChangesOut
    errors: list[VacancySyncErrorOut]


class VacancySyncSummaryOut(Schema):
    buildings: int
    valid_lines: int
    error_lines: int
    ignored_lines: int
    create_buildings: int
    create_houses: int
    update_houses: int
    mark_vacant: int
    mark_rented: int
    preserve_special_status: int


class VacancySyncOut(Schema):
    mode: Literal["preview", "apply"]
    applied: bool
    can_apply: bool
    plan_hash: str | None
    force_rented: bool
    summary: VacancySyncSummaryOut
    blocks: list[VacancySyncBlockOut]
    errors: list[VacancySyncErrorOut]
