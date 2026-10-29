from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID, uuid4

from ninja import Schema
from pydantic import ConfigDict, Field

from apps.house.constants import LeaseStatus, ViewingRecordStatus
from apps.house.schemas.public import PublicHouseListOut
from apps.messaging.schemas import MessagingConversationOut, MessagingMessageOut
from apps.organizations.models import OrganizationMember


class TenantViewingRecordIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    scheduled_at: datetime
    notes: str = Field(default="", max_length=1000)


class TenantContactRequestIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    channels: list[Literal["phone", "wechat"]] = Field(min_length=1, max_length=2)
    phone: str = Field(default="", max_length=32)
    wechat: str = Field(default="", max_length=64)
    client_message_id: UUID = Field(default_factory=uuid4)


class TenantContactRequestOut(Schema):
    notification_id: int | None = None
    inquiry_id: int
    conversation: MessagingConversationOut | None = None
    message: MessagingMessageOut | None = None


class TenantChatIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int = Field(gt=0)


class TenantContactShareIn(Schema):
    model_config = ConfigDict(extra="forbid")

    channels: list[Literal["phone", "wechat"]] = Field(min_length=1, max_length=2)
    phone: str = Field(default="", max_length=32)
    wechat: str = Field(default="", max_length=64)
    client_message_id: UUID


class TenantOrganizationSummaryOut(Schema):
    id: int
    name: str
    slug: str


class TenantViewingReceptionistOut(Schema):
    name: str
    phone: str


class TenantViewingRecordOut(Schema):
    id: int
    house_id: int
    house: PublicHouseListOut
    organization: TenantOrganizationSummaryOut
    scheduled_at: datetime
    viewed_at: datetime | None
    status: str
    status__mapping: str
    signed_lease_id: int | None = None
    receptionist: TenantViewingReceptionistOut | None = None

    @staticmethod
    def resolve_receptionist(obj):
        user = obj.assigned_to
        if user is None or not user.is_active:
            return None
        if hasattr(obj, "receptionist_name"):
            name = obj.receptionist_name
        else:
            name = OrganizationMember.objects.filter(organization_id=obj.organization_id, user=user).values_list("employee_name", flat=True).first()
        if name is None:
            return None
        return {"name": name or user.get_full_name().strip() or user.username, "phone": (user.phone or "") if user.phone_verified else ""}

    @staticmethod
    def resolve_status__mapping(obj):
        return ViewingRecordStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_signed_lease_id(obj):
        return getattr(obj, "signed_lease_id", None)


class TenantLeaseOut(Schema):
    id: int
    house_id: int
    house: PublicHouseListOut
    organization: TenantOrganizationSummaryOut
    source_viewing_record_id: int | None
    sign_at: datetime | None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit: Decimal | None
    payment_day: int
    status: str
    status__mapping: str
    contract_files: list[dict[str, Any]]

    @staticmethod
    def resolve_status__mapping(obj):
        return LeaseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_contract_files(obj):
        return obj.contract_files_resolved
