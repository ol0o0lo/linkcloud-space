import logging
from collections.abc import Callable
from dataclasses import dataclass
from functools import partial
from typing import Any

from django.apps import apps
from django.db import models, transaction
from django.db.models.signals import post_save

from apps.analytics.services import record_event_safely

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PendingModelEvent:
    target_type: str
    target_id: str | int
    actor: Any = None
    properties: dict[str, Any] | None = None
    idempotency_key: str = ""


@dataclass(frozen=True)
class PostSaveEventDefinition:
    model: str
    event_name: str
    build: Callable[[models.Model, bool], PendingModelEvent | None]


def _build_viewing_requested(instance, created: bool) -> PendingModelEvent | None:
    if not created:
        return None
    return PendingModelEvent(
        target_type="house",
        target_id=instance.house_id,
        idempotency_key=f"viewing-requested:{instance.pk}",
    )


def _build_lease_created(instance, created: bool) -> PendingModelEvent | None:
    if not created:
        return None
    return PendingModelEvent(
        target_type="house",
        target_id=instance.house_id,
        properties={"source_viewing_record_id": instance.source_viewing_record_id},
        idempotency_key=f"lease-created:{instance.pk}",
    )


def _build_house_favorite(instance, created: bool) -> PendingModelEvent | None:
    if not created or instance.target_type != "house":
        return None
    return PendingModelEvent(
        target_type=instance.target_type,
        target_id=instance.target_id,
        actor=instance.user,
        idempotency_key=f"house-favorite:{instance.pk}",
    )


# 后端模型埋点统一在这里声明，业务 API 无需显式调用分析服务。
POST_SAVE_EVENT_DEFINITIONS = (
    PostSaveEventDefinition(model="house.ViewingRecord", event_name="viewing.requested", build=_build_viewing_requested),
    PostSaveEventDefinition(model="house.Lease", event_name="lease.created", build=_build_lease_created),
    PostSaveEventDefinition(model="favorites.Favorite", event_name="house.favorite", build=_build_house_favorite),
)


def _handle_post_save(*, definition: PostSaveEventDefinition, instance, created: bool, raw: bool = False, **kwargs) -> None:
    if raw:
        return
    try:
        pending = definition.build(instance, created)
    except Exception:
        logger.exception("Failed to build analytics event %s from %s", definition.event_name, definition.model)
        return
    if pending is None:
        return
    transaction.on_commit(
        partial(
            record_event_safely,
            definition.event_name,
            target_type=pending.target_type,
            target_id=pending.target_id,
            actor=pending.actor,
            source="server",
            properties=pending.properties,
            idempotency_key=pending.idempotency_key,
        )
    )


def register_post_save_receivers() -> None:
    for definition in POST_SAVE_EVENT_DEFINITIONS:
        sender = apps.get_model(definition.model)
        post_save.connect(
            partial(_handle_post_save, definition=definition),
            sender=sender,
            weak=False,
            dispatch_uid=f"analytics.post_save.{definition.model}.{definition.event_name}",
        )
