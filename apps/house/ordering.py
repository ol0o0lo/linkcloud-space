"""Whitelisted server-side ordering for managed house lists."""

from django.db.models import Case, CharField, F, IntegerField, QuerySet, Value, When
from django.db.models.functions import Coalesce, NullIf

from ninja.errors import HttpError

from apps.house.constants import HouseStatus

HOUSE_DEFAULT_ORDERING = "building"
HOUSE_ORDERING_PATTERN = r"^-?[a-z_]+(?:,-?[a-z_]+){0,2}$"
HOUSE_ORDERING_FIELDS = (
    "room_number",
    "layout",
    "building",
    "asking_rent",
    "deposit_amount",
    "landlord",
    "has_elevator_access",
    "status",
    "area",
    "floor",
    "created_at",
    "updated_at",
)
HOUSE_ORDERING_DESCRIPTION = f"排序字段，多个字段使用英文逗号分隔，字段前的 - 表示降序，最多 3 项。允许字段：{'、'.join(HOUSE_ORDERING_FIELDS)}。"

_ESTATE_NAME_ANNOTATION = "_house_ordering_estate_name"
_STATUS_RANK_ANNOTATION = "_house_ordering_status_rank"
_ORDERING_FIELD_PATHS = {
    "room_number": ("room_number",),
    "layout": ("bedrooms", "living_rooms", "bathrooms", "area"),
    "building": (_ESTATE_NAME_ANNOTATION, "building__name", "room_number"),
    "asking_rent": ("asking_rent",),
    "deposit_amount": ("deposit_amount",),
    "landlord": ("landlord__name",),
    "has_elevator_access": ("has_elevator_access",),
    "status": (_STATUS_RANK_ANNOTATION,),
    "area": ("area",),
    "floor": ("floor",),
    "created_at": ("created_at",),
    "updated_at": ("updated_at",),
}
_NULLS_LAST_FIELDS = {
    "bedrooms",
    "living_rooms",
    "bathrooms",
    "area",
    "asking_rent",
    "deposit_amount",
    "landlord__name",
    "floor",
}


def _ordering_expression(field_name: str, *, descending: bool):
    expression = F(field_name)
    nulls_last = field_name in _NULLS_LAST_FIELDS
    if descending:
        return expression.desc(nulls_last=True) if nulls_last else expression.desc()
    return expression.asc(nulls_last=True) if nulls_last else expression.asc()


def _parse_ordering(ordering: str) -> list[tuple[str, bool]]:
    raw_fields = ordering.split(",")
    if len(raw_fields) > 3 or any(not raw_field for raw_field in raw_fields):
        raise HttpError(400, "ordering 必须包含 1 到 3 个非空排序字段")

    parsed: list[tuple[str, bool]] = []
    seen: set[str] = set()
    for raw_field in raw_fields:
        descending = raw_field.startswith("-")
        field_name = raw_field[1:] if descending else raw_field
        if field_name not in _ORDERING_FIELD_PATHS:
            raise HttpError(400, f"ordering 不支持字段 {field_name}；允许字段：{'、'.join(HOUSE_ORDERING_FIELDS)}")
        if field_name in seen:
            continue
        seen.add(field_name)
        parsed.append((field_name, descending))
    return parsed


def apply_house_ordering(queryset: QuerySet, ordering: str) -> QuerySet:
    """Apply validated public ordering aliases and a stable primary-key tie breaker."""
    parsed = _parse_ordering(ordering)
    requested_fields = {field_name for field_name, _descending in parsed}
    annotations = {}
    if "building" in requested_fields:
        annotations[_ESTATE_NAME_ANNOTATION] = Coalesce(
            NullIf("building__estate__display_name", Value("")),
            "building__estate__name",
            Value("未关联项目"),
            output_field=CharField(),
        )
    if "status" in requested_fields:
        annotations[_STATUS_RANK_ANNOTATION] = Case(
            When(status=HouseStatus.LISTED, then=Value(0)),
            When(status=HouseStatus.VACANT, then=Value(1)),
            When(status=HouseStatus.RENOVATING, then=Value(2)),
            When(status=HouseStatus.RENTED, then=Value(3)),
            When(status=HouseStatus.INACTIVE, then=Value(4)),
            default=Value(5),
            output_field=IntegerField(),
        )
    if annotations:
        queryset = queryset.annotate(**annotations)

    expressions = [_ordering_expression(field_path, descending=descending) for field_name, descending in parsed for field_path in _ORDERING_FIELD_PATHS[field_name]]
    return queryset.order_by(*expressions, "pk")
