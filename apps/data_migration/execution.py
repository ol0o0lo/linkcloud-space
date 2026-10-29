"""已确认预检计划的幂等执行；不重放旧版成交、薪资或通知。"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.data_migration.conversion import model_values, target_fingerprint, target_queryset
from apps.data_migration.models import MigrationAssetBinding, MigrationObjectMapping, MigrationRecord
from apps.data_migration.protocol import content_hash
from apps.data_migration.services import FINAL_STATES, mapping_identity
from apps.house.models import Contact, PropertyResponsibility
from apps.organizations.models import Organization, OrganizationMember


class MigrationLeaseLost(Exception):
    pass


def _dependency(record, kind, old_id):
    target = record.batch.records.filter(entity_type=kind, source_id=old_id).first()
    if target is None or target.state not in FINAL_STATES or target.target_id is None:
        raise ValidationError(f"关联的 {kind} 来源记录 {old_id} 尚未成功导入。")
    return target.target_id


@transaction.atomic
def execute_record(record_id, *, token=None):
    org_id = MigrationRecord.objects.values_list("batch__organization_id", flat=True).get(pk=record_id)
    Organization.objects.select_for_update().get(pk=org_id)
    record = MigrationRecord.objects.select_for_update(of=("self",)).select_related("batch__organization").get(pk=record_id)
    if token is not None:
        from apps.data_migration.models import MigrationBatch

        claimed_batch = MigrationBatch.objects.select_for_update().get(pk=record.batch_id)
        if claimed_batch.run_token != token:
            raise MigrationLeaseLost
    if record.state in FINAL_STATES:
        return
    batch = record.batch
    plan = record.prepared
    action = plan.get("action")
    fields = model_values(plan.get("fields", {}))
    target = None
    if action in {"create", "update", "reuse", "skip"} and record.entity_type in {"houses", "buildings", "landlords"}:
        previous = MigrationObjectMapping.objects.filter(**mapping_identity(batch, record)).first()
        current_version = content_hash({"target_id": previous.target_id, "source_hash": previous.source_hash}) if previous else None
        if current_version != plan.get("mapping_version"):
            if action == "create" and previous and previous.source_hash == record.content_hash:
                existing = target_queryset(record.entity_type, batch.organization).filter(pk=previous.target_id).first()
                if existing is None:
                    raise ValidationError("来源映射指向的资料不可用，请重新预检。")
                action = "skip"
                plan["target_id"] = existing.pk
                plan["target_hash"] = target_fingerprint(existing)
            else:
                raise ValidationError("来源映射已在预检后变化，请重新预检。")
        qs = target_queryset(record.entity_type, batch.organization)
        if action == "create":
            if record.entity_type == "houses":
                dependencies = plan.get("dependencies", {})
                if not fields.get("building_id"):
                    fields["building_id"] = _dependency(record, "buildings", dependencies.get("building"))
                if "landlord_id" not in fields and dependencies.get("landlord"):
                    fields["landlord_id"] = _dependency(record, "landlords", dependencies["landlord"])
                if "landlord_id" not in fields and plan.get("inline_landlord"):
                    inline = plan["inline_landlord"]
                    landlord, _ = Contact.objects.get_or_create(organization=batch.organization, name=inline["name"], phone=inline["phone"], defaults={"roles": ["landlord"]})
                    if not landlord.has_role("landlord"):
                        landlord.roles = [*landlord.roles, "landlord"]
                        landlord.save(update_fields=["roles", "updated_at"])
                    fields["landlord_id"] = landlord.pk
                target = qs.model.objects.create(**fields)
            else:
                target = qs.model.objects.create(organization=batch.organization, **fields)
        else:
            target = qs.select_for_update(of=("self",)).get(pk=plan["target_id"])
            if plan.get("target_hash") != target_fingerprint(target):
                raise ValidationError("目标资料已在预检后修改，请重新预检确认。")
            if action == "update":
                if record.entity_type == "houses":
                    deps = plan.get("dependencies", {})
                    if not fields.get("building_id"):
                        fields["building_id"] = _dependency(record, "buildings", deps.get("building"))
                    if "landlord_id" not in fields and deps.get("landlord"):
                        fields["landlord_id"] = _dependency(record, "landlords", deps["landlord"])
                if "extra" in fields:
                    fields["extra"] = {**target.extra, **fields["extra"]}
                for field, value in fields.items():
                    setattr(target, field, value)
                target.save()
            elif record.entity_type == "landlords" and not target.has_role("landlord"):
                target.roles = [*target.roles, "landlord"]
                target.save(update_fields=["roles", "updated_at"])
        record.target_type = record.entity_type
        record.target_id = target.pk
        MigrationObjectMapping.objects.update_or_create(
            **mapping_identity(batch, record),
            defaults={"target_type": record.target_type, "target_id": target.pk, "source_hash": record.content_hash, "target_hash": target_fingerprint(target)},
        )
        record.state = {"create": "created", "update": "updated", "reuse": "reused", "skip": "skipped"}[action]
    elif record.entity_type == "staff" and action == "reuse":
        OrganizationMember.objects.get(organization=batch.organization, user_id=plan["target_id"], user__is_active=True)
        record.target_type = "staff"
        record.target_id = plan["target_id"]
        record.state = "reused"
        MigrationObjectMapping.objects.update_or_create(
            **mapping_identity(batch, record),
            defaults={"target_type": "staff", "target_id": record.target_id, "source_hash": record.content_hash, "target_hash": ""},
        )
    elif action == "responsibility":
        member = OrganizationMember.objects.get(organization=batch.organization, user_id=fields["user_id"], user__is_active=True)
        landlord_id = _dependency(record, "landlords", plan["dependencies"]["landlord"])
        target, created = PropertyResponsibility.objects.get_or_create(organization=batch.organization, member=member, landlord_id=landlord_id)
        record.target_type = "responsibilities"
        record.target_id = target.pk
        record.state = "created" if created else "reused"
    else:
        record.state = "archived"
        if record.entity_type == "team" and not record.source_deleted and (fields.get("apply_name") or fields.get("apply_logo")):
            record.target_type = "team"
            record.target_id = batch.organization_id
            target = batch.organization
            if plan.get("organization_version") != target_fingerprint(target):
                raise ValidationError("组织资料已在预检后变化，请重新预检。")
            if fields.get("apply_name"):
                target.name = fields["name"]
                target.save(update_fields=["name", "updated_at"])
    if target is not None and record.target_type in {"houses", "buildings", "team"}:
        media_fields = {binding.field for binding in record.media_bindings.all()} & {"images", "videos", "logo"}
        if record.entity_type == "team" and not fields.get("apply_logo"):
            media_fields.discard("logo")
        originals = {field: getattr(target, field) for field in media_fields if hasattr(target, field)}
        record.prepared["media_originals"] = originals
        record.prepared["media_expected"] = {field: content_hash(refs) for field, refs in originals.items()}
    record.error_message = ""
    record.save()
    MigrationAssetBinding.objects.filter(record=record, field="archive").update(state="archive")


@transaction.atomic
def attach_asset(asset_id, *, force=False):
    from apps.house.models import Building, House

    models = {"houses": House, "buildings": Building, "team": Organization}
    bindings = list(MigrationAssetBinding.objects.filter(asset_id=asset_id, active=True).values_list("record_id", "field").distinct())
    for record_id, field in bindings:
        record = MigrationRecord.objects.select_for_update().select_related("batch").get(pk=record_id)
        if record.state not in FINAL_STATES:
            continue
        model = models.get(record.target_type)
        if model is None or field not in {"images", "videos", "logo"} or record.source_deleted:
            continue
        qs = model.objects.select_for_update(of=("self",))
        if record.target_type == "houses":
            qs = qs.filter(building__organization_id=record.batch.organization_id)
        elif record.target_type == "buildings":
            qs = qs.filter(organization_id=record.batch.organization_id)
        else:
            qs = qs.filter(pk=record.batch.organization_id)
        target = qs.filter(pk=record.target_id).first()
        if target is None or not hasattr(target, field):
            continue
        current = getattr(target, field)
        expected = record.prepared.get("media_expected", {}).get(field)
        if force:
            record.prepared.setdefault("media_originals", {})[field] = current
            expected = content_hash(current)
        if expected != content_hash(current):
            record.media_bindings.filter(field=field, active=True).update(state="detached", active=False)
            continue
        originals = list(record.prepared.get("media_originals", {}).get(field, []))
        media_ids = {ref if isinstance(ref, int) else ref["media_id"] for ref in originals}
        limit = 1 if field == "logo" else 3 if field == "videos" else 9
        additions = record.media_bindings.filter(field=field, active=True, asset__status="succeeded", asset__media_file__isnull=False).select_related("asset")
        for binding in additions:
            media_id = binding.asset.media_file_id
            if media_id in media_ids:
                binding.state = "attached"
            elif len(originals) < limit:
                originals.append({"media_id": media_id, "media_type": binding.asset.media_type})
                media_ids.add(media_id)
                binding.state = "attached"
            else:
                binding.state = "overflow"
            binding.save(update_fields=["state", "updated_at"])
        if originals != current:
            setattr(target, field, originals)
            target.save(update_fields=[field, "updated_at"])
        record.prepared.setdefault("media_expected", {})[field] = content_hash(getattr(target, field))
        record.save(update_fields=["prepared", "updated_at"])
