from dataclasses import dataclass
from typing import Any

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


@dataclass(frozen=True)
class AnalyticsTargetDisplayItemDefinition:
    target_type: str
    target_id_path: str
    label_path: str


@dataclass(frozen=True)
class AnalyticsTargetDefinition:
    key: str
    label: str
    model: str
    organization_path: str
    organization_filter: str
    public_filters: dict[str, Any]
    ranking_select_related: tuple[str, ...]
    ranking_display: tuple[AnalyticsTargetDisplayItemDefinition, ...]

    @property
    def model_class(self):
        model_class = apps.get_model(self.model)
        if model_class is None:
            raise ImproperlyConfigured(f"Unknown analytics target model: {self.model}")
        return model_class


@dataclass(frozen=True)
class AnalyticsEventDefinition:
    key: str
    label: str
    target_types: tuple[str, ...]
    allow_anonymous: bool
    client_collectible: bool
    deduplicate_seconds: int
    property_keys: tuple[str, ...]


def _normalize_target(key: str, entry: dict) -> AnalyticsTargetDefinition:
    return AnalyticsTargetDefinition(
        key=key,
        label=entry.get("label", key),
        model=entry["model"],
        organization_path=entry.get("organization_path", "organization"),
        organization_filter=entry.get("organization_filter", "organization"),
        public_filters=dict(entry.get("public_filters", {})),
        ranking_select_related=tuple(entry.get("ranking_select_related", ())),
        ranking_display=tuple(
            AnalyticsTargetDisplayItemDefinition(
                target_type=item["target_type"],
                target_id_path=item["target_id_path"],
                label_path=item["label_path"],
            )
            for item in entry.get("ranking_display", ())
        ),
    )


def _normalize_event(entry: dict) -> AnalyticsEventDefinition:
    return AnalyticsEventDefinition(
        key=entry["key"],
        label=entry.get("label", entry["key"]),
        target_types=tuple(entry.get("target_types", ())),
        allow_anonymous=bool(entry.get("allow_anonymous", False)),
        client_collectible=bool(entry.get("client_collectible", True)),
        deduplicate_seconds=max(0, int(entry.get("deduplicate_seconds", 0))),
        property_keys=tuple(entry.get("property_keys", ())),
    )


def get_target_definition(key: str) -> AnalyticsTargetDefinition | None:
    entry = settings.ANALYTICS_TARGETS.get(key)
    return _normalize_target(key, entry) if entry else None


def get_target_definitions() -> list[AnalyticsTargetDefinition]:
    return [_normalize_target(key, entry) for key, entry in settings.ANALYTICS_TARGETS.items()]


def get_event_definition(key: str) -> AnalyticsEventDefinition | None:
    for entry in settings.ANALYTICS_EVENTS:
        if entry.get("key") == key:
            return _normalize_event(entry)
    return None


def get_event_definitions() -> list[AnalyticsEventDefinition]:
    return [_normalize_event(entry) for entry in settings.ANALYTICS_EVENTS]


def resolve_path(obj, path: str):
    value = obj
    for part in path.split("."):
        value = getattr(value, part)
        if callable(value):
            value = value()
    return value
