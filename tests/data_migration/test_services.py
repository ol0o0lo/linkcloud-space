from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

import pytest
from model_bakery import baker

from apps.data_migration.models import MigrationBatch, MigrationRecord
from apps.data_migration.services import confirm_batch, create_batch, preview_batch, validate_batch
from apps.data_migration.tasks import execute_batch
from apps.house.models import Contact, House, Lease
from tests.data_migration.helpers import make_package, sample_records


@pytest.fixture
def owner():
    user = baker.make("accounts.User")
    org = baker.make("organizations.Organization")
    baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=True)
    return user, org


def uploaded_package(records):
    return SimpleUploadedFile("migration.zip", make_package(records).getvalue(), content_type="application/zip")


@pytest.mark.django_db
def test_import_is_idempotent_and_bills_are_historical(owner, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    user, org = owner
    with patch("apps.data_migration.tasks.enqueue_validation"), patch("apps.data_migration.tasks.enqueue_import"):
        batch = create_batch(organization=org, actor=user, file=uploaded_package(sample_records()))
        validate_batch(batch.pk)
        batch.refresh_from_db()
        assert not batch.preview["issues"]
        confirm_batch(batch, version=batch.preview["version"])
        execute_batch.run(str(batch.pk))
    batch.refresh_from_db()
    assert batch.status == MigrationBatch.Status.COMPLETED
    house = House.objects.get(building__organization=org)
    assert house.room_number == "301" and house.bedrooms == 1 and house.living_rooms == 0
    assert str(house.asking_rent) == "1250.50"
    assert not Lease.objects.filter(organization=org).exists()
    assert MigrationRecord.objects.get(batch=batch, entity_type="bills").state == "archived"
    with patch("apps.data_migration.tasks.enqueue_validation"):
        same = create_batch(organization=org, actor=user, file=uploaded_package(sample_records()))
    assert same.pk == batch.pk
    execute_batch.run(str(batch.pk))
    assert House.objects.filter(building__organization=org).count() == 1
    assert Contact.objects.filter(organization=org).count() == 1


@pytest.mark.django_db
def test_preview_requires_real_missing_fields_and_rejects_other_org_mapping(owner, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    user, org = owner
    records = sample_records()
    records["buildings"][0].pop("name")
    records["buildings"][0].pop("floors")
    with patch("apps.data_migration.tasks.enqueue_validation"):
        batch = create_batch(organization=org, actor=user, file=uploaded_package(records))
    validate_batch(batch.pk)
    batch.refresh_from_db()
    assert any(issue["field"] == "name" for issue in batch.preview["issues"])
    other_contact = baker.make("house.Contact", organization=baker.make("organizations.Organization"), name="其他房东", phone="13900139000", roles=["landlord"])
    preview_batch(
        batch,
        {
            "overrides": [{"entity_type": "buildings", "source_id": "2", "fields": {"name": "确认公寓", "floors": 8}}],
            "mappings": [{"entity_type": "landlords", "source_id": "1", "target_id": other_contact.pk}],
        },
    )
    batch.refresh_from_db()
    assert any(issue["code"] == "invalid_mapping" for issue in batch.preview["issues"])


@pytest.mark.django_db
def test_two_packages_for_same_source_cannot_import_concurrently(owner, settings, tmp_path):
    from ninja.errors import HttpError

    settings.MEDIA_ROOT = str(tmp_path)
    user, org = owner
    with patch("apps.data_migration.tasks.enqueue_validation"), patch("apps.data_migration.tasks.enqueue_import"):
        first = create_batch(organization=org, actor=user, file=uploaded_package(sample_records()))
        different_zip = make_package(sample_records(), extra_files={"export-report.json": b'{"issues":[],"attempt":2}'})
        second = create_batch(organization=org, actor=user, file=SimpleUploadedFile("next.zip", different_zip.getvalue()))
        validate_batch(first.pk)
        validate_batch(second.pk)
        first.refresh_from_db()
        second.refresh_from_db()
        confirm_batch(first, version=first.preview["version"])
        with pytest.raises(HttpError, match="其他|另一个"):
            confirm_batch(second, version=second.preview["version"])
        execute_batch.run(str(first.pk))
        second = preview_batch(second, {})
        confirm_batch(second, version=second.preview["version"])
        execute_batch.run(str(second.pk))
    assert House.objects.filter(building__organization=org).count() == 1


@pytest.mark.django_db
def test_expired_worker_cannot_change_successful_record(owner):
    import uuid

    user, org = owner
    batch = MigrationBatch.objects.create(organization=org, created_by=user, package_hash="f" * 64, status=MigrationBatch.Status.IMPORTING)
    record = MigrationRecord.objects.create(batch=batch, entity_type="team", source_id="42", content_hash="f" * 64, prepared={"action": "archive"})

    def stale_worker(_record_id, *, token):
        MigrationRecord.objects.filter(pk=record.pk).update(state="created")
        MigrationBatch.objects.filter(pk=batch.pk).update(run_token=uuid.uuid4())
        raise OSError("旧连接断开")

    with patch("apps.data_migration.execution.execute_record", side_effect=stale_worker):
        execute_batch.run(str(batch.pk))
    record.refresh_from_db()
    batch.refresh_from_db()
    assert record.state == "created"
    assert batch.status == MigrationBatch.Status.IMPORTING


@pytest.mark.django_db
def test_package_storage_is_private_and_has_no_public_url(owner):
    user, org = owner
    with patch("apps.data_migration.tasks.enqueue_validation"):
        batch = create_batch(organization=org, actor=user, file=uploaded_package(sample_records()))
    with pytest.raises(ValueError, match="鉴权"):
        _ = batch.package.url
    assert "/public/" not in batch.package.path


@pytest.mark.django_db
def test_unmapped_staff_can_be_bound_after_import_without_recreating_houses(owner, settings, tmp_path):
    from apps.house.models import PropertyResponsibility

    settings.MEDIA_ROOT = str(tmp_path)
    user, org = owner
    original_name = org.name
    records = sample_records()
    records["staff"] = [{"id": 7, "realName": "旧员工"}]
    records["staff_landlord_relations"] = [{"id": 8, "staff_id": 7, "landlord_id": 1}]
    with patch("apps.data_migration.tasks.enqueue_validation"), patch("apps.data_migration.tasks.enqueue_import"):
        batch = create_batch(organization=org, actor=user, file=uploaded_package(records))
        validate_batch(batch.pk)
        batch.refresh_from_db()
        confirm_batch(batch, version=batch.preview["version"])
        execute_batch.run(str(batch.pk))
        assert batch.records.get(entity_type="staff").state == "archived"
        batch = preview_batch(batch, {"member_mappings": {"7": user.pk}})
        confirm_batch(batch, version=batch.preview["version"])
        execute_batch.run(str(batch.pk))
    assert batch.records.get(entity_type="staff").target_id == user.pk
    assert PropertyResponsibility.objects.filter(organization=org, member__user=user).count() == 1
    assert House.objects.filter(building__organization=org).count() == 1
    org.refresh_from_db()
    assert org.name == original_name


@pytest.mark.django_db
def test_team_profile_is_applied_only_after_explicit_confirmation(owner, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    user, org = owner
    with patch("apps.data_migration.tasks.enqueue_validation"), patch("apps.data_migration.tasks.enqueue_import"):
        batch = create_batch(organization=org, actor=user, file=uploaded_package(sample_records()))
        validate_batch(batch.pk)
        batch = preview_batch(batch, {"overrides": [{"entity_type": "team", "source_id": "42", "fields": {"apply_name": True}}]})
        confirm_batch(batch, version=batch.preview["version"])
        execute_batch.run(str(batch.pk))
    org.refresh_from_db()
    assert org.name == "旧团队"


@pytest.mark.django_db
def test_early_inline_landlord_is_preserved_as_real_contact(owner, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    user, org = owner
    records = sample_records()
    records["landlords"] = []
    records["houses"][0]["landlordNew_id"] = None
    records["houses"][0].update(landlord="早期房东", phone="13800138000")
    with patch("apps.data_migration.tasks.enqueue_validation"), patch("apps.data_migration.tasks.enqueue_import"):
        batch = create_batch(organization=org, actor=user, file=uploaded_package(records))
        validate_batch(batch.pk)
        batch.refresh_from_db()
        assert not batch.preview["issues"]
        confirm_batch(batch, version=batch.preview["version"])
        execute_batch.run(str(batch.pk))
    house = House.objects.get(building__organization=org)
    assert house.landlord.name == "早期房东"
    assert house.landlord.has_role("landlord")
    assert batch.records.count() == 4
