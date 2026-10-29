from datetime import UTC, date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404

from ninja import File, Query, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_owner
from apps.data_migration.models import MigrationAsset, MigrationBatch, MigrationRecord
from apps.data_migration.schemas import AssetOut, AssetRetryIn, BatchOut, ConfirmIn, PreviewIn, RecordOut
from apps.data_migration.services import batch_assets, confirm_batch, create_batch, media_summary, preview_batch, require_owner
from apps.media.services import validate_media_refs

router = Router(tags=["组织/数据迁移"])


def organization(request):
    org = require_org_owner(request)
    require_owner(org, request.user)
    return org


def get_batch(request, batch_id):
    return get_object_or_404(MigrationBatch.objects.filter(organization=organization(request)), pk=batch_id)


@router.get("/options/", response=dict, summary="迁移组织和成员选项")
def options(request):
    org = organization(request)
    return {
        "organization": {"id": org.pk, "name": org.name, "slug": org.slug},
        "can_manage": True,
        "members": [
            {"id": member.user_id, "name": member.employee_name or member.user.get_full_name() or member.user.username}
            for member in org.organizationmember_set.filter(user__is_active=True).select_related("user")
        ],
    }


@router.get("/batches/", response=list[BatchOut], summary="迁移任务列表")
@paginate(LegacyPagination)
def list_batches(request):
    return MigrationBatch.objects.filter(organization=organization(request))


@router.post("/batches/", response=BatchOut, summary="上传 Uhome 迁移包")
def upload_batch(request, file: UploadedFile = File(...)):
    return create_batch(organization=organization(request), actor=request.user, file=file)


@router.get("/batches/{batch_id}/", response=BatchOut, summary="迁移任务详情")
def batch_detail(request, batch_id: UUID):
    return get_batch(request, batch_id)


@router.post("/batches/{batch_id}/preview/", response=BatchOut, summary="补全资料并重新预检")
def preview(request, batch_id: UUID, payload: PreviewIn):
    return preview_batch(get_batch(request, batch_id), payload.model_dump())


@router.post("/batches/{batch_id}/confirm/", response=BatchOut, summary="确认预检并开始后台导入")
def confirm(request, batch_id: UUID, payload: ConfirmIn):
    return confirm_batch(get_batch(request, batch_id), version=payload.preview_version)


@router.post("/batches/{batch_id}/retry/", response=BatchOut, summary="恢复迁移任务及失败资源")
def retry_batch(request, batch_id: UUID):
    batch = get_batch(request, batch_id)
    from apps.data_migration.tasks import enqueue_asset, enqueue_validation

    if batch.status == MigrationBatch.Status.FAILED and not batch.records.exists():
        batch.status = MigrationBatch.Status.UPLOADED
        batch.error_message = ""
        batch.save()
        enqueue_validation(batch.pk)
    elif batch.status == MigrationBatch.Status.PARTIAL_FAILED:
        batch = preview_batch(batch, batch.decisions)
        if not batch.preview["issues"]:
            batch.records.filter(state="failed").update(state="pending", error_message="")
            batch = confirm_batch(batch, version=batch.preview["version"])
    for asset in batch_assets(batch).filter(status__in=["failed", "missing"]):
        asset.status = "pending"
        asset.attempts = 0
        asset.error_message = ""
        asset.save()
        enqueue_asset(asset.pk)
    return batch


@router.get("/batches/{batch_id}/records/", response=list[RecordOut], summary="查看来源记录及处理结果")
@paginate(LegacyPagination)
def records(request, batch_id: UUID, entity_type: str | None = None, state: str | None = None, search: str | None = None):
    qs = get_batch(request, batch_id).records.all()
    if entity_type:
        qs = qs.filter(entity_type=entity_type)
    if state:
        qs = qs.filter(state=state)
    if search:
        qs = qs.filter(Q(source_id__icontains=search) | Q(data__icontains=search))
    return qs


@router.get("/batches/{batch_id}/assets/", response=list[AssetOut], summary="查看媒体迁移进度及异常")
@paginate(LegacyPagination)
def assets(request, batch_id: UUID, status: str | None = None):
    qs = batch_assets(get_batch(request, batch_id))
    return qs.filter(status=status) if status else qs


@router.post("/assets/{asset_id}/retry/", response=AssetOut, summary="重试、修正来源或补传迁移资源")
def retry_asset(request, asset_id: UUID, payload: AssetRetryIn):
    from apps.data_migration.execution import attach_asset
    from apps.data_migration.media import remote_target
    from apps.data_migration.tasks import enqueue_asset, update_media_status

    org = organization(request)
    with transaction.atomic():
        asset = get_object_or_404(MigrationAsset.objects.select_for_update().filter(organization=org), pk=asset_id)
        if asset.status == "processing":
            raise HttpError(409, "媒体正在处理，请稍后重试。")
        if payload.media_id is not None:
            from apps.media.models import MediaFile

            media = get_object_or_404(MediaFile.objects.filter(file__startswith=f"uploads/orgs/{org.pk}/", resource_type=asset.resource_type), pk=payload.media_id)
            validate_media_refs([{"media_id": media.pk, "media_type": asset.media_type}], allowed_resource_types=[asset.resource_type], allowed_media_types=[asset.media_type])
            asset.media_file = media
            asset.status = "succeeded"
        elif payload.source_url is not None:
            try:
                remote_target(payload.source_url)
            except ValueError as exc:
                raise HttpError(422, str(exc)) from exc
            except OSError as exc:
                raise HttpError(503, "旧资源域名暂时无法解析，请稍后重试。") from exc
            asset.source_url = payload.source_url
            asset.status = "pending"
        elif asset.status != "succeeded":
            asset.status = "pending"
        asset.attempts = 0
        asset.error_message = ""
        asset.run_token = None
        asset.save()
        if asset.status == "succeeded":
            asset.bindings.filter(state="detached").update(active=True)
            attach_asset(asset.pk, force=True)
        else:
            transaction.on_commit(lambda: enqueue_asset(asset.pk), robust=True)
    for batch_id in asset.bindings.values_list("record__batch_id", flat=True).distinct():
        update_media_status(batch_id)
    return asset


@router.get("/archives/", response=list[RecordOut], summary="查询旧版历史档案")
@paginate(LegacyPagination)
def archives(
    request,
    entity_type: str | None = None,
    search: str | None = None,
    batch_id: UUID | None = None,
    created_from: date | None = None,
    created_to: date | None = None,
    staff_id: str | None = None,
    bill_number: str | None = None,
    checked: bool | None = Query(None),
    approved: bool | None = Query(None),
    source_deleted: bool | None = Query(None),
):
    org = organization(request)
    qs = MigrationRecord.objects.filter(batch__organization=org, state="archived").select_related("batch")
    if batch_id:
        qs = qs.filter(batch_id=batch_id)
    else:
        latest = MigrationRecord.objects.filter(
            batch__organization=org,
            entity_type=OuterRef("entity_type"),
            source_id=OuterRef("source_id"),
            batch__source_instance_id=OuterRef("batch__source_instance_id"),
            batch__source_team_id=OuterRef("batch__source_team_id"),
            state="archived",
        ).order_by("-batch__created_at", "-id")
        qs = qs.filter(pk=Subquery(latest.values("pk")[:1]))
    if entity_type:
        qs = qs.filter(entity_type=entity_type)
    if search:
        qs = qs.filter(Q(source_id__icontains=search) | Q(data__icontains=search))
    if created_from:
        start = datetime.combine(created_from, time.min, tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(UTC).isoformat(timespec="microseconds")
        qs = qs.filter(source_created_at__gte=start)
    if created_to:
        end = datetime.combine(created_to + timedelta(days=1), time.min, tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(UTC).isoformat(timespec="microseconds")
        qs = qs.filter(source_created_at__lt=end)
    if staff_id:
        condition = Q(data__staff_id=staff_id)
        if staff_id.isdigit():
            condition |= Q(data__staff_id=int(staff_id))
        qs = qs.filter(condition)
    if bill_number:
        qs = qs.filter(data__bill_number__icontains=bill_number)
    for key, value in (("checked", checked), ("approved", approved)):
        if value is not None:
            qs = qs.filter(**{f"data__{key}": value})
    if source_deleted is not None:
        qs = qs.filter(source_deleted=source_deleted)
    return qs


@router.get("/archives/{record_id}/", response=RecordOut, summary="查看历史档案详情")
def archive_detail(request, record_id: int):
    return get_object_or_404(MigrationRecord.objects.filter(batch__organization=organization(request)), pk=record_id)


@router.get("/batches/{batch_id}/report/", response=dict, summary="迁移核对报告")
def report(request, batch_id: UUID):
    from apps.data_migration.reporting import financial_totals, record_counts

    batch = get_batch(request, batch_id)
    return {
        "batch_id": str(batch.pk),
        "source_team_name": batch.source_team_name,
        "manifest": batch.manifest,
        "status": batch.status,
        "summary": batch.summary,
        "record_summary": record_counts(batch),
        "financial_totals": financial_totals(batch),
        "media_status": batch.media_status,
        "media_summary": media_summary(batch),
        "issues": batch.preview.get("issues", []),
        "record_errors": list(batch.records.filter(state="failed").values("entity_type", "source_id", "error_message")),
        "media_errors": list(batch_assets(batch).filter(status__in=["failed", "missing"]).values("id", "status", "error_message")),
    }
