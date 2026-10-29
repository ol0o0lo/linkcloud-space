import io
import zipfile

import pytest

from apps.data_migration.protocol import PackageError, PackageReader
from tests.data_migration.helpers import make_package, sample_records


def test_reads_complete_package_without_media_downloads():
    with PackageReader(make_package(sample_records())) as package:
        rows = list(package.records())
        assert package.manifest["source_team_id"] == "42"
        assert len(rows) == 5
        assert next(row for row in rows if row["entity_type"] == "houses")["data"]["rent"] == "1250.50"
        assert list(package.media()) == []


def test_rejects_checksum_tampering_and_path_traversal():
    with pytest.raises(PackageError, match="路径|文件"), PackageReader(make_package(extra_files={"../escape.json": b"{}"})):
        pass
    source = make_package(sample_records())
    target = io.BytesIO()
    with zipfile.ZipFile(source) as archive, zipfile.ZipFile(target, "w") as altered:
        for name in archive.namelist():
            altered.writestr(name, b"{}\n" if name == "data/houses.jsonl" else archive.read(name))
    target.seek(0)
    with pytest.raises(PackageError, match="校验|大小|记录"), PackageReader(target) as package:
        list(package.records())


def test_rejects_credentials_and_duplicate_source_id():
    with pytest.raises(PackageError, match="敏感|凭据"), PackageReader(make_package({"staff": [{"id": 1, "password": "secret"}]})) as package:
        list(package.records())
    with pytest.raises(PackageError, match="重复"), PackageReader(make_package({"houses": [{"id": 1}, {"id": 1}]})) as package:
        list(package.records())
