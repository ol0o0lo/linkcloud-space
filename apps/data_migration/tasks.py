import logging
import uuid
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from celery import shared_task

from apps.data_migration.models import MigrationAsset, MigrationBatch, MigrationRecord

logger = logging.getLogger(__name__)
LEASE = timedelta(minutes=15)


def _enqueue(task, key):
    try:
        task.apply_async(args=[str(key)], retry=False)
        return True
    except Exception:
        logger.warning("迁移任务投递失败，等待恢复器重新投递。", extra={"migration_id": str(key)})
        return False


def enqueue_validation(batch_id):
    return _enqueue(validate_package, batch_id)


def enqueue_import(batch_id):
    return _enqueue(execute_batch, batch_id)


def enqueue_asset(asset_id):
    return _enqueue(migrate_asset, asset_id)


@shared_task(acks_late=True, reject_on_worker_lost=True)
def validate_package(batch_id):
    from apps.data_migration.services import validate_batch

    with transaction.atomic():
        batch = MigrationBatch.objects.select_for_update().filter(pk=batch_id).first()
        if not batch or batch.status not in {MigrationBatch.Status.UPLOADED, MigrationBatch.Status.VALIDATING}:
            return
        if batch.run_token and batch.heartbeat_at and batch.heartbeat_at > timezone.now() - LEASE:
            return
        batch.run_token = uuid.uuid4()
        batch.heartbeat_at = timezone.now()
        batch.status = MigrationBatch.Status.VALIDATING
        batch.save(update_fields=["run_token", "heartbeat_at", "status", "updated_at"])
    validate_batch(batch_id)
    MigrationBatch.objects.filter(pk=batch_id, run_token=batch.run_token).update(run_token=None)


@shared_task(acks_late=True, reject_on_worker_lost=True)
def execute_batch(batch_id):
    from apps.data_migration.execution import MigrationLeaseLost, attach_asset, execute_record
    from apps.data_migration.services import FINAL_STATES, batch_assets, refresh_summary

    token = uuid.uuid4()
    with transaction.atomic():
        batch = MigrationBatch.objects.select_for_update().get(pk=batch_id)
        if batch.status != MigrationBatch.Status.IMPORTING:
            return
        if batch.run_token and batch.heartbeat_at and batch.heartbeat_at > timezone.now() - LEASE:
            return
        batch.run_token = token
        batch.heartbeat_at = timezone.now()
        batch.save(update_fields=["run_token", "heartbeat_at", "updated_at"])
    order = {"team": 0, "staff": 1, "landlords": 2, "buildings": 3, "houses": 4, "staff_landlord_relations": 5}
    records = sorted(batch.records.values_list("id", "entity_type"), key=lambda item: (order.get(item[1], 6), item[0]))
    for record_id, _ in records:
        if not MigrationBatch.objects.filter(pk=batch_id, run_token=token).update(heartbeat_at=timezone.now()):
            return
        try:
            execute_record(record_id, token=token)
        except MigrationLeaseLost:
            return
        except Exception as exc:
            from django.core.exceptions import ValidationError

            message = "；".join(exc.messages) if isinstance(exc, ValidationError) else "记录导入失败，请重新预检或重试。"
            MigrationRecord.objects.filter(pk=record_id, batch__run_token=token).exclude(state__in=FINAL_STATES).update(state="failed", error_message=message[:2000])
            logger.warning("迁移记录执行失败。", extra={"record_id": record_id, "error_type": type(exc).__name__})
    summary = refresh_summary(batch, token=token)
    status = MigrationBatch.Status.PARTIAL_FAILED if summary["failed"] or summary["pending"] else MigrationBatch.Status.COMPLETED
    updated = MigrationBatch.objects.filter(pk=batch_id, run_token=token).update(status=status, finished_at=timezone.now(), run_token=None, heartbeat_at=timezone.now())
    if not updated:
        return
    for asset in batch_assets(batch):
        if asset.status == "succeeded":
            attach_asset(asset.pk)
        elif asset.status == "pending":
            enqueue_asset(asset.pk)
    update_media_status(batch_id)


def update_media_status(batch_id):
    from apps.data_migration.services import media_summary

    batch = MigrationBatch.objects.get(pk=batch_id)
    counts = media_summary(batch)
    detached = batch.records.filter(media_bindings__state="detached", media_bindings__asset__status="succeeded").exists()
    status = "processing" if counts["pending"] or counts["processing"] else "failed" if counts["failed"] or counts["missing"] or detached else "completed"
    MigrationBatch.objects.filter(pk=batch_id).update(media_status=status)


@shared_task(bind=True, max_retries=3, acks_late=True, reject_on_worker_lost=True)
def migrate_asset(self, asset_id):
    from apps.data_migration.execution import attach_asset
    from apps.data_migration.media import MissingRemoteMedia, migrate_remote_file

    token = uuid.uuid4()
    with transaction.atomic():
        asset = MigrationAsset.objects.select_for_update().get(pk=asset_id)
        if asset.status == "succeeded":
            attach_asset(asset.pk)
            return
        if asset.status != "pending":
            return
        asset.status = "processing"
        asset.attempts += 1
        asset.run_token = token
        asset.heartbeat_at = timezone.now()
        asset.save()
    try:
        media = migrate_remote_file(asset, token)
        updated = MigrationAsset.objects.filter(pk=asset_id, run_token=token).update(
            status="succeeded", media_file=media, error_message="", run_token=None, heartbeat_at=timezone.now()
        )
        if updated:
            attach_asset(asset_id)
    except MissingRemoteMedia as exc:
        MigrationAsset.objects.filter(pk=asset_id, run_token=token).update(status="missing", error_message=str(exc), run_token=None)
    except Exception as exc:
        from apps.data_migration.media import RemoteMediaError

        message = str(exc) if isinstance(exc, RemoteMediaError) else "媒体读取或存储失败，请重试。"
        retrying = asset.attempts <= self.max_retries and self.request.retries < self.max_retries and not isinstance(exc, RemoteMediaError)
        MigrationAsset.objects.filter(pk=asset_id, run_token=token).update(status="pending" if retrying else "failed", error_message=message[:1000], run_token=None)
        if retrying:
            raise self.retry(countdown=15 * 2**self.request.retries) from exc
    finally:
        for batch_id in MigrationRecord.objects.filter(media_bindings__asset_id=asset_id).values_list("batch_id", flat=True).distinct():
            update_media_status(batch_id)


@shared_task
def recover_migration_tasks():
    cutoff = timezone.now() - LEASE
    for batch in MigrationBatch.objects.filter(status__in=[MigrationBatch.Status.UPLOADED, MigrationBatch.Status.VALIDATING]).filter(
        Q(heartbeat_at__isnull=True) | Q(heartbeat_at__lt=cutoff)
    )[:100]:
        enqueue_validation(batch.pk)
    for batch in MigrationBatch.objects.filter(status=MigrationBatch.Status.IMPORTING).filter(Q(run_token__isnull=True) | Q(heartbeat_at__lt=cutoff))[:100]:
        enqueue_import(batch.pk)
    MigrationAsset.objects.filter(status="processing", heartbeat_at__lt=cutoff).update(status="pending", run_token=None)
    for asset in MigrationAsset.objects.filter(
        status="pending", bindings__record__batch__status__in=[MigrationBatch.Status.COMPLETED, MigrationBatch.Status.PARTIAL_FAILED]
    ).distinct()[:200]:
        enqueue_asset(asset.pk)
