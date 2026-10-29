from collections import defaultdict
from decimal import Decimal, InvalidOperation

from django.db.models import Count


def record_counts(batch):
    result = defaultdict(lambda: {"total": 0})
    for dataset in batch.manifest.get("datasets", []):
        result[dataset["entity_type"]] = {"total": 0}
    for item in batch.records.order_by().values("entity_type", "state").annotate(total=Count("id")):
        counts = result[item["entity_type"]]
        counts[item["state"]] = item["total"]
        counts["total"] += item["total"]
    return dict(result)


def financial_totals(batch):
    """仅核对当前包的旧金额，按原类型、审核及删除状态分组，不入账。"""
    groups = {}
    for record in batch.records.filter(entity_type__in=["bills", "salaries"]).iterator():
        data = record.data
        checked = data.get("checked") if isinstance(data.get("checked"), bool) else None
        approved = data.get("approved") if isinstance(data.get("approved"), bool) else None
        key = (record.entity_type, str(data.get("bill_type", "")), checked, approved, record.source_deleted)
        if key not in groups:
            groups[key] = {
                "entity_type": key[0],
                "bill_type": key[1],
                "checked": checked,
                "approved": approved,
                "source_deleted": key[4],
                "records": 0,
                "amounts": {},
                "invalid_amounts": 0,
            }
        group = groups[key]
        group["records"] += 1
        for field in ("real_rent", "profit") if record.entity_type == "bills" else ("salary",):
            try:
                amount = Decimal(str(data.get(field)))
                if not amount.is_finite():
                    raise InvalidOperation
                group["amounts"][field] = group["amounts"].get(field, Decimal("0")) + amount
            except (InvalidOperation, TypeError, ValueError):
                group["invalid_amounts"] += 1
    return [{**group, "amounts": {key: str(value) for key, value in group["amounts"].items()}} for group in groups.values()]
