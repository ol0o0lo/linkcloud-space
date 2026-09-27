from datetime import datetime

from ninja import Schema
from pydantic import Field

from apps.house.constants import HouseStatus
from apps.house.formatters import format_house_layout
from apps.house.schemas import PublicHouseListOut, building_display_label
from apps.media.schemas import ResolvedMediaRefOut
from apps.platform_operations.constants import ContentDisplayStatus, ContentEntryKind, HomeBannerAction
from apps.platform_operations.services import get_schedule_status, render_home_markdown


def _obj_value(obj, field: str, default=None):
    return obj.get(field, default) if isinstance(obj, dict) else getattr(obj, field, default)


def _resolved_media(obj, field: str):
    if isinstance(obj, dict):
        return obj.get(field, [])
    return getattr(obj, f"{field}_resolved")


class ContentEntryCreateIn(Schema):
    kind: str
    eyebrow: str = Field("", max_length=40)
    title: str = Field(..., min_length=1, max_length=120)
    summary: str = Field(..., min_length=1, max_length=240)
    cover_image: list[dict] = Field(default_factory=list, max_length=1)
    body_markdown: str = ""
    tone: str
    sort_order: int = Field(100, ge=0)
    is_enabled: bool = False
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class ContentEntryPatchIn(Schema):
    kind: str | None = None
    eyebrow: str | None = Field(None, max_length=40)
    title: str | None = Field(None, min_length=1, max_length=120)
    summary: str | None = Field(None, min_length=1, max_length=240)
    cover_image: list[dict] | None = Field(None, max_length=1)
    body_markdown: str | None = None
    tone: str | None = None
    sort_order: int | None = Field(None, ge=0)
    is_enabled: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class ContentEntryAdminOut(Schema):
    id: int
    kind: str
    kind__mapping: str
    slug: str
    eyebrow: str
    title: str
    summary: str
    cover_image: list[ResolvedMediaRefOut]
    body_markdown: str
    tone: str
    sort_order: int
    is_enabled: bool
    starts_at: datetime | None
    ends_at: datetime | None
    display_status: str
    display_status__mapping: str
    house_count: int
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_kind__mapping(obj):
        return ContentEntryKind.get_choice_label(_obj_value(obj, "kind"))

    @staticmethod
    def resolve_cover_image(obj):
        return _resolved_media(obj, "cover_image")

    @staticmethod
    def resolve_display_status(obj):
        return get_schedule_status(obj)

    @staticmethod
    def resolve_display_status__mapping(obj):
        return ContentDisplayStatus.get_choice_label(get_schedule_status(obj))

    @staticmethod
    def resolve_house_count(obj):
        count = _obj_value(obj, "house_count")
        return count if count is not None else obj.house_links.count()


class HomeBannerCreateIn(Schema):
    eyebrow: str = Field("", max_length=40)
    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(..., min_length=1, max_length=240)
    button_text: str = Field("查看详情", min_length=1, max_length=20)
    image: list[dict] = Field(default_factory=list, max_length=1)
    tone: str
    action_type: str
    entry_id: int | None = None
    sort_order: int = Field(100, ge=0)
    is_enabled: bool = False
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class HomeBannerPatchIn(Schema):
    eyebrow: str | None = Field(None, max_length=40)
    title: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, min_length=1, max_length=240)
    button_text: str | None = Field(None, min_length=1, max_length=20)
    image: list[dict] | None = Field(None, max_length=1)
    tone: str | None = None
    action_type: str | None = None
    entry_id: int | None = None
    sort_order: int | None = Field(None, ge=0)
    is_enabled: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class HomeBannerAdminOut(Schema):
    id: int
    eyebrow: str
    title: str
    description: str
    button_text: str
    image: list[ResolvedMediaRefOut]
    tone: str
    action_type: str
    action_type__mapping: str
    entry_id: int | None
    entry_title: str | None
    sort_order: int
    is_enabled: bool
    starts_at: datetime | None
    ends_at: datetime | None
    display_status: str
    display_status__mapping: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_image(obj):
        return _resolved_media(obj, "image")

    @staticmethod
    def resolve_action_type__mapping(obj):
        return HomeBannerAction.get_choice_label(_obj_value(obj, "action_type"))

    @staticmethod
    def resolve_entry_id(obj):
        return _obj_value(obj, "entry_id")

    @staticmethod
    def resolve_entry_title(obj):
        entry = _obj_value(obj, "entry")
        return entry.title if entry else None

    @staticmethod
    def resolve_display_status(obj):
        return get_schedule_status(obj)

    @staticmethod
    def resolve_display_status__mapping(obj):
        return ContentDisplayStatus.get_choice_label(get_schedule_status(obj))


class ContentHouseAdminOut(Schema):
    id: int
    display_name: str
    status: str
    status__mapping: str
    layout: str
    area: str | None
    asking_rent: str | None
    images: list[ResolvedMediaRefOut]

    @staticmethod
    def resolve_display_name(obj):
        return f"{building_display_label(obj.building)} / {obj.room_number}"

    @staticmethod
    def resolve_status__mapping(obj):
        return HouseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_layout(obj):
        return format_house_layout(obj.bedrooms, obj.living_rooms)

    @staticmethod
    def resolve_area(obj):
        return str(obj.area) if obj.area is not None else None

    @staticmethod
    def resolve_asking_rent(obj):
        return str(obj.asking_rent) if obj.asking_rent is not None else None

    @staticmethod
    def resolve_images(obj):
        return obj.images_resolved


class ContentEntryHouseAdminOut(Schema):
    house: ContentHouseAdminOut
    sort_order: int
    recommendation_reason: str


class ContentEntryHouseItemIn(Schema):
    house_id: int
    recommendation_reason: str = Field("", max_length=120)


class ContentEntryHousesPutIn(Schema):
    items: list[ContentEntryHouseItemIn]


class ContentEntrySummaryOut(Schema):
    slug: str
    kind: str
    eyebrow: str
    title: str
    summary: str
    cover_image: list[ResolvedMediaRefOut]
    tone: str

    @staticmethod
    def resolve_cover_image(obj):
        return _resolved_media(obj, "cover_image")


class ContentEntryDetailOut(ContentEntrySummaryOut):
    body_html: str

    @staticmethod
    def resolve_body_html(obj):
        return render_home_markdown(_obj_value(obj, "body_markdown", ""))


class HomeBannerPublicOut(Schema):
    id: int
    eyebrow: str
    title: str
    description: str
    button_text: str
    image: list[ResolvedMediaRefOut]
    tone: str
    action_type: str
    entry_slug: str | None

    @staticmethod
    def resolve_image(obj):
        return _resolved_media(obj, "image")

    @staticmethod
    def resolve_entry_slug(obj):
        entry = _obj_value(obj, "entry")
        return entry.slug if entry else None


class HomeContentOut(Schema):
    banners: list[HomeBannerPublicOut]
    topics: list[ContentEntrySummaryOut]
    guides: list[ContentEntrySummaryOut]


class ContentEntryHousePublicOut(Schema):
    house: PublicHouseListOut
    recommendation_reason: str
