from unittest.mock import patch

import pytest
from model_bakery import baker

from apps.data_migration.execution import attach_asset
from apps.data_migration.media import RemoteMediaError, remote_target
from apps.data_migration.models import MigrationAsset, MigrationAssetBinding, MigrationBatch, MigrationRecord
from apps.data_migration.protocol import content_hash
from apps.media.constants import ResourceType


def test_remote_url_rejects_unknown_hosts_and_private_resolution(settings):
    settings.DATA_MIGRATION_ALLOWED_MEDIA_HOSTS = ["old.example.com"]
    with pytest.raises(RemoteMediaError, match="来源"):
        remote_target("https://attacker.example/asset.jpg")
    with patch("socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]), pytest.raises(RemoteMediaError, match="网络"):
        remote_target("https://old.example.com/asset.jpg")


@pytest.mark.django_db
def test_attach_keeps_order_and_does_not_overwrite_later_user_edits():
    org = baker.make("organizations.Organization")
    user = baker.make("accounts.User")
    batch = MigrationBatch.objects.create(organization=org, created_by=user, package_hash="a" * 64)
    building = baker.make("house.Building", organization=org, name="媒体测试楼", address="测试路 1 号", floors=3)
    house = baker.make("house.House", building=building, room_number="101")
    record = MigrationRecord.objects.create(
        batch=batch,
        entity_type="houses",
        source_id="1",
        state="created",
        target_type="houses",
        target_id=house.pk,
        content_hash="a" * 64,
        prepared={"media_originals": {"images": []}, "media_expected": {"images": content_hash([])}},
    )
    media = baker.make("media.MediaFile", resource_type=ResourceType.HOUSE_IMAGE, file=f"uploads/orgs/{org.pk}/old.jpg", file_size=100)
    asset = MigrationAsset.objects.create(
        organization=org,
        source_identity="b" * 64,
        source_url="https://old.example/a.jpg",
        resource_type=ResourceType.HOUSE_IMAGE,
        media_type="image",
        status="succeeded",
        media_file=media,
    )
    binding = MigrationAssetBinding.objects.create(record=record, asset=asset, field="images", position=0)
    attach_asset(asset.pk)
    house.refresh_from_db()
    assert house.images[0]["media_id"] == media.pk
    house.images = []
    house.save(update_fields=["images", "updated_at"])
    attach_asset(asset.pk)
    house.refresh_from_db()
    binding.refresh_from_db()
    assert house.images == []
    assert binding.state == "detached" and not binding.active


@pytest.mark.django_db
def test_background_media_copy_registers_and_attaches_real_image(settings, tmp_path):
    import io

    from PIL import Image

    from apps.data_migration.tasks import migrate_asset

    settings.MEDIA_ROOT = str(tmp_path / "media")
    org = baker.make("organizations.Organization")
    user = baker.make("accounts.User")
    batch = MigrationBatch.objects.create(organization=org, created_by=user, package_hash="d" * 64, status=MigrationBatch.Status.COMPLETED)
    building = baker.make("house.Building", organization=org, name="搬迁测试楼", address="测试路 2 号", floors=3)
    house = baker.make("house.House", building=building, room_number="201")
    record = MigrationRecord.objects.create(
        batch=batch,
        entity_type="houses",
        source_id="2",
        state="created",
        target_type="houses",
        target_id=house.pk,
        content_hash="d" * 64,
        prepared={"media_originals": {"images": []}, "media_expected": {"images": content_hash([])}},
    )
    asset = MigrationAsset.objects.create(
        organization=org, source_identity="e" * 64, source_url="https://old.example/image.png", resource_type=ResourceType.HOUSE_IMAGE, media_type="image"
    )
    MigrationAssetBinding.objects.create(record=record, asset=asset, field="images", position=0)
    image = io.BytesIO()
    Image.new("RGB", (4, 4), "white").save(image, "PNG")
    payload = image.getvalue()

    class Response(io.BytesIO):
        def getheader(self, name):
            return {"Content-Type": "image/png", "Content-Length": str(len(payload))}.get(name)

    from unittest.mock import Mock

    with patch("apps.data_migration.media.open_remote", return_value=(Mock(), Response(payload), asset.source_url)):
        migrate_asset.run(str(asset.pk))
    asset.refresh_from_db()
    house.refresh_from_db()
    assert asset.status == "succeeded" and asset.media_file_id is not None
    assert asset.media_file.file.name.startswith(f"uploads/orgs/{org.pk}/")
    assert asset.media_file.file.size == len(payload)
    assert house.images[0]["media_id"] == asset.media_file_id


@pytest.mark.django_db
def test_recovered_delivery_does_not_reset_automatic_retry_budget():
    from apps.data_migration.tasks import migrate_asset

    org = baker.make("organizations.Organization")
    batch = baker.make("data_migration.MigrationBatch", organization=org, status=MigrationBatch.Status.COMPLETED)
    record = MigrationRecord.objects.create(batch=batch, entity_type="surveys", source_id="1", state="archived", content_hash="c" * 64)
    asset = MigrationAsset.objects.create(
        organization=org, source_identity="c" * 64, source_url="https://old.example/missing.png", resource_type=ResourceType.LEGACY_ARCHIVE_ASSET, media_type="image", attempts=3
    )
    MigrationAssetBinding.objects.create(record=record, asset=asset, field="archive")
    with patch("apps.data_migration.media.open_remote", side_effect=OSError("暂时不可达")):
        migrate_asset.run(str(asset.pk))
    asset.refresh_from_db()
    assert asset.attempts == 4
    assert asset.status == "failed"
