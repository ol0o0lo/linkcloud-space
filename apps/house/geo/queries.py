from __future__ import annotations

from dataclasses import dataclass
from functools import reduce
from operator import or_

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Case, CharField, F, JSONField, Q, Value, When
from django.db.models.functions import Least


@dataclass(frozen=True)
class NamedGeoOrigin:
    name: str
    location: Point
    line_names: tuple[str, ...]


def filter_by_viewport(queryset, field_name: str, viewport):
    return queryset.filter(**{f"{field_name}__intersects": viewport})


def apply_nearby_house_filter(queryset, origin, radius_m: int):
    return queryset.filter(building__location__distance_lte=(origin, D(m=radius_m)))


def annotate_house_distance(queryset, origin):
    return queryset.annotate(distance=Distance("building__location", origin, spheroid=True))


def apply_named_origins_house_filter(queryset, origins: list[NamedGeoOrigin], radius_m: int):
    if not origins:
        return queryset

    radius_filter = reduce(or_, [Q(building__location__distance_lte=(origin.location, D(m=radius_m))) for origin in origins])
    queryset = queryset.filter(building__location__isnull=False).filter(radius_filter)
    if len(origins) == 1:
        origin = origins[0]
        return queryset.annotate(
            distance=Distance("building__location", origin.location, spheroid=True),
            nearest_metro_station_name=Value(origin.name, output_field=CharField()),
            nearest_metro_line_names=Value(list(origin.line_names), output_field=JSONField()),
        )

    distance_aliases = {f"_metro_distance_{index}": Distance("building__location", origin.location, spheroid=True) for index, origin in enumerate(origins)}
    queryset = queryset.alias(**distance_aliases)
    alias_names = list(distance_aliases)
    nearest_station_cases = []
    nearest_line_cases = []
    for index, origin in enumerate(origins):
        alias = alias_names[index]
        condition = Q()
        for other_alias in alias_names:
            if other_alias != alias:
                condition &= Q(**{f"{alias}__lte": F(other_alias)})
        nearest_station_cases.append(When(condition, then=Value(origin.name)))
        nearest_line_cases.append(When(condition, then=Value(list(origin.line_names), output_field=JSONField())))

    return queryset.annotate(
        distance=Least(*[F(alias) for alias in alias_names]),
        nearest_metro_station_name=Case(*nearest_station_cases, default=Value(""), output_field=CharField()),
        nearest_metro_line_names=Case(
            *nearest_line_cases,
            default=Value([], output_field=JSONField()),
            output_field=JSONField(),
        ),
    )
