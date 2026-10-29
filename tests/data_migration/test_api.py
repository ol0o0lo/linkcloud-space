import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile

import pytest
from model_bakery import baker

from apps.data_migration.models import MigrationBatch
from apps.data_migration.services import validate_batch
from tests.api_helpers import api_data
from tests.data_migration.helpers import make_package, sample_records


@pytest.fixture
def logged_in(client):
    user = baker.make("accounts.User")
    org = baker.make("organizations.Organization")
    baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=True)
    client.force_login(user)
    session = client.session
    session["organization_data"] = json.dumps({"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": True})
    session.save()
    return client, user, org


@pytest.mark.django_db
def test_upload_preview_and_cross_org_permissions(logged_in, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    client, user, org = logged_in
    assert client.get("/api/data-migration/options/").status_code == 200
    with patch("apps.data_migration.tasks.enqueue_validation"):
        response = client.post("/api/data-migration/batches/", {"file": SimpleUploadedFile("package.zip", make_package(sample_records()).getvalue())})
    assert response.status_code == 200, response.content
    batch_id = api_data(response)["id"]
    validate_batch(batch_id)
    response = client.get(f"/api/data-migration/batches/{batch_id}/")
    assert response.status_code == 200, response.content
    assert api_data(response)["status"] == "awaiting_confirmation"
    result = api_data(client.get("/api/data-migration/batches/", {"page": 1, "page_size": 1}))
    assert result["total"] == 1 and result["page_size"] == 1
    other = baker.make("data_migration.MigrationBatch", organization=baker.make("organizations.Organization"), created_by=user, package_hash="a" * 64)
    assert client.get(f"/api/data-migration/batches/{other.pk}/").status_code == 404
    org.organizationmember_set.filter(user=user).update(is_owner=False)
    assert client.get(f"/api/data-migration/batches/{batch_id}/").status_code == 403


@pytest.mark.django_db
def test_confirmation_rejects_stale_preview_and_filters_historical_records(logged_in, settings, tmp_path):
    settings.MEDIA_ROOT = str(tmp_path)
    client, _, _ = logged_in
    with patch("apps.data_migration.tasks.enqueue_validation"):
        response = client.post("/api/data-migration/batches/", {"file": SimpleUploadedFile("package.zip", make_package(sample_records()).getvalue())})
    batch_id = api_data(response)["id"]
    validate_batch(batch_id)
    stale = client.post(f"/api/data-migration/batches/{batch_id}/confirm/", data=json.dumps({"preview_version": "old"}), content_type="application/json")
    assert stale.status_code == 409
    batch = MigrationBatch.objects.get(pk=batch_id)
    bill = batch.records.get(entity_type="bills")
    bill.state = "archived"
    bill.source_created_at = "2026-10-25T08:00:00+00:00"
    bill.save()
    response = client.get("/api/data-migration/archives/", {"entity_type": "bills", "bill_number": "OLD001", "created_from": "2026-10-01", "approved": "true"})
    assert response.status_code == 200, response.content
    assert api_data(response)["total"] == 1
    report = api_data(client.get(f"/api/data-migration/batches/{batch_id}/report/"))
    assert report["record_summary"]["bills"]["archived"] == 1
    assert report["financial_totals"][0]["amounts"]["profit"] == "300.25"
    bill.source_created_at = "2026-10-24T16:30:00.000000+00:00"
    bill.save()
    response = client.get("/api/data-migration/archives/", {"created_from": "2026-10-25", "created_to": "2026-10-25", "entity_type": "bills"})
    assert api_data(response)["total"] == 1
