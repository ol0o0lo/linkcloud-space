"""django-ninja paginator with a minimal page/page_size contract."""

from typing import Any

from django.conf import settings
from django.db.models import QuerySet

from ninja import Schema
from ninja.pagination import PaginationBase


class LegacyPagination(PaginationBase):
    default_page_size: int = 15
    max_page_size: int = 500

    class Input(Schema):
        page: int = 1
        page_size: int | None = None

    class Output(Schema):
        items: list[Any] = []
        total: int
        page: int
        page_size: int

    items_attribute: str = "items"

    def paginate_queryset(self, queryset: QuerySet, pagination: Input, **_params) -> dict:
        page = max(pagination.page, 1)
        page_size = pagination.page_size or self.default_page_size
        page_size = max(1, min(page_size, self.max_page_size))

        total = queryset.count() if isinstance(queryset, QuerySet) else len(queryset)
        offset = (page - 1) * page_size
        items = list(queryset[offset : offset + page_size])

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }


def make_pagination(default_page_size: int = 15, default_ordering: str = "") -> type[LegacyPagination]:
    """Build a ``LegacyPagination`` subclass with view-specific defaults."""
    return type(
        "LegacyPagination_custom",
        (LegacyPagination,),
        {"default_page_size": default_page_size, "default_ordering": default_ordering},
    )


# Convenience instance for the default page size pulled from Django settings.
DEFAULT_PAGE_SIZE = getattr(settings, "DEFAULT_PAGE_SIZE", 15)
LegacyPagination.default_page_size = DEFAULT_PAGE_SIZE
