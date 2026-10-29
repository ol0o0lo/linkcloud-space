"""迁移媒体仅作为读取附加信息，不能作为正常表单媒体引用提交。"""

from urllib.parse import urlsplit

from django.conf import settings

from apps.data_migration.models import MigrationAssetBinding
from apps.data_migration.protocol import content_hash


def display_url(asset):
    if asset.media_file_id:
        return asset.media_file.file.url
    parsed = urlsplit(asset.source_url)
    allowed = {host.lower() for host in getattr(settings, "DATA_MIGRATION_ALLOWED_MEDIA_HOSTS", [])}
    if parsed.scheme in {"http", "https"} and parsed.hostname and parsed.hostname.lower() in allowed and not parsed.username and not parsed.password:
        return asset.source_url
    return None


def migration_media_for(obj):
    if isinstance(obj, dict) or not getattr(obj, "pk", None):
        return []
    if hasattr(obj, "_migration_media_cache"):
        return obj._migration_media_cache
    kind = {"house": "houses", "building": "buildings", "organization": "team"}.get(obj._meta.model_name)
    if kind is None:
        return []
    org_id = obj.pk if kind == "team" else obj.building.organization_id if kind == "houses" else obj.organization_id
    bindings = MigrationAssetBinding.objects.filter(
        record__target_type=kind,
        record__target_id=obj.pk,
        record__batch__organization_id=org_id,
        record__source_deleted=False,
        record__state__in=["created", "updated", "reused", "skipped", "archived"],
        active=True,
        field__in=["images", "videos", "logo"],
        state="pending",
    ).select_related("asset__media_file", "record")
    result = []
    seen = set()
    for binding in bindings:
        field = binding.field
        if not hasattr(obj, field) or binding.record.prepared.get("media_expected", {}).get(field) != content_hash(getattr(obj, field)):
            continue
        identity = (binding.asset_id, field)
        if identity in seen:
            continue
        seen.add(identity)
        result.append(
            {
                "id": str(binding.asset_id),
                "field": field,
                "position": binding.position,
                "url": display_url(binding.asset),
                "media_type": binding.asset.media_type,
                "status": binding.asset.status,
                "media_file_id": binding.asset.media_file_id,
            }
        )
    obj._migration_media_cache = result
    return result


def archive_media_for(record):
    return [
        {
            "id": str(binding.asset_id),
            "field": binding.field,
            "position": binding.position,
            "url": display_url(binding.asset),
            "media_type": binding.asset.media_type,
            "status": binding.asset.status,
            "media_file_id": binding.asset.media_file_id,
            "binding_state": binding.state,
            "source_meta": binding.source_meta,
        }
        for binding in record.media_bindings.select_related("asset__media_file")
    ]
