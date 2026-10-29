import pytest


@pytest.fixture(autouse=True)
def private_package_directory(settings, tmp_path):
    settings.DATA_MIGRATION_PRIVATE_ROOT = str(tmp_path / "private-migration-packages")
