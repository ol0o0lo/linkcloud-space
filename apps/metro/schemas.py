from typing import Literal

from ninja import Schema
from pydantic import Field


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

