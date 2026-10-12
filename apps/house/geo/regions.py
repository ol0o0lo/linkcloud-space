"""楼栋行政区的统一读取与房源查询表达式。"""

from django.db.models import CharField, Value
from django.db.models.functions import Coalesce, NullIf, Trim

REGION_FIELDS = ("province", "city", "district", "subdistrict")


def building_region(building) -> dict[str, str]:
    estate = building.estate if building.estate_id else None
    return {field: getattr(building, field).strip() or (getattr(estate, field).strip() if estate else "") for field in REGION_FIELDS}


def annotate_house_regions(qs):
    return qs.annotate(
        **{
            f"region_{field}": Coalesce(
                NullIf(Trim(f"building__{field}"), Value("")),
                NullIf(Trim(f"building__estate__{field}"), Value("")),
                Value(""),
                output_field=CharField(max_length=64),
            )
            for field in REGION_FIELDS
        }
    )
