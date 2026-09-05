from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal

from django.utils import timezone

from ninja import Schema
from pydantic import ConfigDict, Field, field_validator, model_validator

from apps.house.constants import HouseDecoration, HouseMatchMode

HouseMatchSort = Literal["latest", "rent_asc", "rent_desc", "area_asc", "area_desc"]


def default_house_match_expiry() -> datetime:
    return timezone.now() + timedelta(days=30)


class HouseMatchCriteriaIn(Schema):
    model_config = ConfigDict(extra="forbid")

    keyword: str | None = Field(None, max_length=150)
    province: str | None = Field(None, max_length=64)
    city: str | None = Field(None, max_length=64)
    district: str | None = Field(None, max_length=64)
    min_rent: Decimal | None = Field(None, ge=0)
    max_rent: Decimal | None = Field(None, ge=0)
    min_area: Decimal | None = Field(None, ge=0)
    max_area: Decimal | None = Field(None, ge=0)
    bedrooms: int | None = Field(None, ge=0)
    living_rooms: int | None = Field(None, ge=0)
    decoration: Literal[HouseDecoration.RAW, HouseDecoration.SIMPLE, HouseDecoration.FINE, HouseDecoration.LUXURY] | None = None
    has_elevator_access: bool | None = None
    tags: list[str] = Field(default_factory=list, max_length=20)
    sort: HouseMatchSort = "latest"

    @field_validator("keyword", "province", "city", "district", mode="before")
    @classmethod
    def normalize_optional_text(cls, value):
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            tag = str(value).strip()
            if tag and tag not in normalized:
                normalized.append(tag)
        return normalized

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.min_rent is not None and self.max_rent is not None and self.min_rent > self.max_rent:
            raise ValueError("最低租金不能高于最高租金。")
        if self.min_area is not None and self.max_area is not None and self.min_area > self.max_area:
            raise ValueError("最小面积不能大于最大面积。")
        return self

    def has_filter(self) -> bool:
        values = self.model_dump(exclude={"sort"}, exclude_none=True)
        return any(value not in ("", []) for value in values.values())

    def to_storage(self) -> dict:
        return self.model_dump(mode="json", exclude_none=True)


class HouseMatchShareCreateIn(Schema):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=150)
    remark: str = Field("", max_length=5000)
    mode: Literal[HouseMatchMode.MANUAL, HouseMatchMode.DYNAMIC]
    house_ids: list[int] = Field(default_factory=list)
    criteria: HouseMatchCriteriaIn | None = None
    expires_at: datetime | None = Field(default_factory=default_house_match_expiry)

    @field_validator("title", "remark")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def validate_mode_payload(self):
        if not self.title:
            raise ValueError("配房标题不能为空。")
        if self.mode == HouseMatchMode.MANUAL:
            if not self.house_ids:
                raise ValueError("手工配房至少需要选择一套房源。")
            if self.criteria is not None:
                raise ValueError("手工配房不能同时提交动态条件。")
        else:
            if self.house_ids:
                raise ValueError("动态配房不能同时提交手工房源。")
            if self.criteria is None or not self.criteria.has_filter():
                raise ValueError("动态配房至少需要一个筛选条件。")
        if self.expires_at is not None:
            if timezone.is_naive(self.expires_at):
                raise ValueError("到期时间必须包含时区。")
            if self.expires_at <= timezone.now():
                raise ValueError("到期时间必须晚于当前时间。")
        return self


class HouseMatchShareCreateOut(Schema):
    share_key: str
    share_url: str
    expires_at: datetime | None
    created_at: datetime


class HouseMatchShareOut(Schema):
    id: int
    share_key: str
    share_url: str
    title: str
    mode: str
    status: Literal["active", "expired", "revoked"]
    expires_at: datetime | None
    revoked_at: datetime | None
    view_count: int
    last_accessed_at: datetime | None
    created_at: datetime


class HouseMatchShareExtendIn(Schema):
    expires_at: datetime

    @field_validator("expires_at")
    @classmethod
    def validate_expiry(cls, value: datetime) -> datetime:
        if timezone.is_naive(value):
            raise ValueError("到期时间必须包含时区。")
        if value <= timezone.now():
            raise ValueError("到期时间必须晚于当前时间。")
        return value


class HouseMatchConsultantOut(Schema):
    id: int
    name: str
    avatar_url: str | None
    phone: str | None


class PublicHouseMatchShareOut(Schema):
    title: str
    remark: str
    mode: str
    created_at: datetime
    expires_at: datetime | None
    consultant: HouseMatchConsultantOut | None
