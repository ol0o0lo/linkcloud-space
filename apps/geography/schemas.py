from typing import Literal

from ninja import Schema
from pydantic import ConfigDict, Field, field_validator

from apps.geography.coordinates import validate_longitude_latitude


class GeoPointIn(Schema):
    model_config = ConfigDict(extra="forbid")

    longitude: float
    latitude: float
    coordinate_system: Literal["gcj02"]

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, value: float) -> float:
        return validate_longitude_latitude(value, 0)[0]

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, value: float) -> float:
        return validate_longitude_latitude(0, value)[1]


class GeoPointOut(Schema):
    longitude: float
    latitude: float
    coordinate_system: Literal["gcj02"] = "gcj02"


class LocatedRegionOut(Schema):
    province: str
    city: str
    district: str


class NearbyPoiItemOut(Schema):
    id: str
    name: str
    address: str
    distance: int


class NearbyPoisOut(Schema):
    bus: list[NearbyPoiItemOut]
    subway: list[NearbyPoiItemOut]
    education: list[NearbyPoiItemOut]
    medical: list[NearbyPoiItemOut]


class MetroImportStationIn(Schema):
    name: str = Field(min_length=1, max_length=64)
    aliases: list[str] = Field(default_factory=list)
    district: str = ""
    address: str = ""
    longitude: float
    latitude: float
    sort_order: int = Field(ge=0)


class MetroImportLineIn(Schema):
    name: str = Field(min_length=1, max_length=64)
    color: str = Field(default="", max_length=16)
    sort_order: int = Field(ge=0)
    is_loop: bool = False
    stations: list[MetroImportStationIn]


class MetroImportCityIdentityIn(Schema):
    name: str = Field(min_length=1, max_length=64)
    province: str = Field(min_length=1, max_length=64)


class MetroCityImportIn(Schema):
    schema_version: Literal[1]
    data_version: str = Field(min_length=1, max_length=64)
    coordinate_system: Literal["gcj02", "wgs84"]
    city: MetroImportCityIdentityIn
    lines: list[MetroImportLineIn]


class PublicMetroStationOut(Schema):
    name: str


class PublicMetroLineOut(Schema):
    name: str
    color: str
    stations: list[PublicMetroStationOut]


class PublicMetroCitySummaryOut(Schema):
    name: str
    province: str


class PublicMetroCityDetailOut(PublicMetroCitySummaryOut):
    data_version: str
    lines: list[PublicMetroLineOut]
