from __future__ import annotations

from apps.base.exceptions import ConflictException, NotFoundException
from apps.house.commute.search import apply_commute_filter, get_search
from apps.house.exceptions import HouseInvalidException
from apps.house.queries.public import filter_signature, public_houses_for_filters


def search_public_houses(*, filters, commute_search_id=None, sort="latest"):
    commute_job = None
    if commute_search_id:
        commute_job = get_search(commute_search_id)
        if commute_job is None:
            raise NotFoundException("通勤搜索已过期，请重新选择目的地")
        if commute_job["filter_signature"] != filter_signature(filters):
            raise ConflictException("房源条件已变化，请重新计算通勤范围")
    elif sort == "commute_asc":
        raise HouseInvalidException("请先选择通勤条件")
    qs = public_houses_for_filters(filters, sort="latest" if sort == "commute_asc" else sort)
    if commute_job:
        qs = apply_commute_filter(qs, commute_job)
    return qs.order_by("commute_seconds", "pk") if sort == "commute_asc" else qs
