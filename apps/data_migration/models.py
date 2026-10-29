import uuid

from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.data_migration.storage import PrivateMigrationStorage


def package_upload_path(instance, filename):
    return f"migration-packages/orgs/{instance.organization_id}/{instance.pk}.zip"


class MigrationBatch(CreateUpdateTimeModelMixin):
    class Status(models.TextChoices):
        UPLOADED = "uploaded", "已上传"
        VALIDATING = "validating", "校验中"
        BLOCKED = "blocked", "需要处理"
        AWAITING = "awaiting_confirmation", "待确认"
        IMPORTING = "importing", "导入中"
        COMPLETED = "completed", "数据已导入"
        PARTIAL_FAILED = "partial_failed", "部分失败"
        FAILED = "failed", "失败"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="migration_batches")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="migration_batches")
    package = models.FileField(upload_to=package_upload_path, storage=PrivateMigrationStorage())
    package_hash = models.CharField(max_length=64)
    source_instance_id = models.CharField(max_length=150, blank=True)
    source_team_id = models.CharField(max_length=64, blank=True)
    source_team_name = models.CharField(max_length=150, blank=True)
    source_export_id = models.CharField(max_length=64, blank=True)
    manifest = models.JSONField(default=dict)
    status = models.CharField(max_length=32, choices=Status, default=Status.UPLOADED, db_index=True)
    media_status = models.CharField(max_length=20, default="pending")
    preview = models.JSONField(default=dict)
    decisions = models.JSONField(default=dict)
    summary = models.JSONField(default=dict)
    error_message = models.TextField(blank=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    run_token = models.UUIDField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["organization", "package_hash"], name="migration_batch_org_package_unique")]


class MigrationRecord(CreateUpdateTimeModelMixin):
    batch = models.ForeignKey(MigrationBatch, on_delete=models.PROTECT, related_name="records")
    entity_type = models.CharField(max_length=40, db_index=True)
    source_id = models.CharField(max_length=128)
    data = models.JSONField(default=dict)
    content_hash = models.CharField(max_length=64)
    source_deleted = models.BooleanField(default=False)
    source_created_at = models.CharField(max_length=64, blank=True)
    source_updated_at = models.CharField(max_length=64, blank=True)
    state = models.CharField(max_length=20, default="pending", db_index=True)
    error_message = models.TextField(blank=True)
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    prepared = models.JSONField(default=dict)

    class Meta:
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["batch", "entity_type", "source_id"], name="migration_record_source_unique")]


class MigrationObjectMapping(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT)
    source_instance_id = models.CharField(max_length=150)
    source_team_id = models.CharField(max_length=64)
    entity_type = models.CharField(max_length=40)
    source_id = models.CharField(max_length=128)
    target_type = models.CharField(max_length=40)
    target_id = models.PositiveBigIntegerField()
    source_hash = models.CharField(max_length=64)
    target_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "source_instance_id", "source_team_id", "entity_type", "source_id"], name="migration_object_source_unique")]


class MigrationAsset(CreateUpdateTimeModelMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT)
    source_identity = models.CharField(max_length=64)
    source_url = models.URLField(max_length=4096)
    object_key = models.CharField(max_length=1024, blank=True)
    resource_type = models.CharField(max_length=40)
    media_type = models.CharField(max_length=10)
    status = models.CharField(max_length=20, default="pending", db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    media_file = models.ForeignKey("media.MediaFile", on_delete=models.PROTECT, null=True, blank=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    run_token = models.UUIDField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        constraints = [models.UniqueConstraint(fields=["organization", "source_identity", "resource_type"], name="migration_asset_source_unique")]


class MigrationAssetBinding(CreateUpdateTimeModelMixin):
    record = models.ForeignKey(MigrationRecord, on_delete=models.PROTECT, related_name="media_bindings")
    asset = models.ForeignKey(MigrationAsset, on_delete=models.PROTECT, related_name="bindings")
    field = models.CharField(max_length=40)
    position = models.PositiveIntegerField(default=0)
    state = models.CharField(max_length=20, default="pending")
    active = models.BooleanField(default=True)
    source_meta = models.JSONField(default=dict)

    class Meta:
        ordering = ["position", "id"]
        constraints = [models.UniqueConstraint(fields=["record", "field", "position"], name="migration_binding_position_unique")]
