from datetime import datetime
from typing import Literal

from ninja import Schema
from pydantic import ConfigDict, Field

from apps.house.schemas.common import HouseSummaryOut
from apps.house.schemas.leases import LeaseOut
from apps.house.schemas.viewings import ViewingRecordOut


class InquiryPatchIn(Schema):
    model_config = ConfigDict(extra="forbid")
    customer_name: str = Field(default="", max_length=100)
    phone: str = Field(default="", max_length=32)
    wechat: str = Field(default="", max_length=100)
    notes: str = Field(default="", max_length=10000)
    status: Literal["new", "processing", "closed"] = "processing"


class InquiryAssignIn(Schema):
    model_config = ConfigDict(extra="forbid")
    assigned_to_id: int


class InquiryContactOut(Schema):
    id: int
    name: str
    phone: str
    wechat: str


class InquiryOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    contact_id: int | None
    customer_name: str
    phone: str
    wechat: str
    assigned_to_id: int | None
    assigned_to_name: str
    status: str
    status_label: str
    notes: str
    viewing_count: int
    signed_lease_id: int | None
    created_at: datetime
    can_manage: bool
    can_process: bool
    viewings: list[ViewingRecordOut] = Field(default_factory=list)
    leases: list[LeaseOut] = Field(default_factory=list)
