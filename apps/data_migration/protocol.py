"""受限 ZIP/JSONL 协议；不展开文件到磁盘、不请求媒体 URL。"""

import hashlib
import json
import math
import stat
import zipfile
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from django.conf import settings

DATASETS = (
    "team",
    "settings",
    "identities",
    "staff",
    "staff_team_relations",
    "landlords",
    "buildings",
    "houses",
    "house_team_relations",
    "staff_landlord_relations",
    "bills",
    "bill_team_relations",
    "salaries",
    "surveys",
    "house_stats",
    "auth_applications",
)
MAX_LINE_BYTES = 2 * 1024 * 1024
SENSITIVE_KEYS = {
    "password",
    "access_key",
    "access_key_id",
    "access_key_secret",
    "secret",
    "appsecret",
    "wx_appsecret",
    "token",
    "access_token",
    "refresh_token",
    "session_key",
    "openid",
    "wechat_id",
    "wx_union_id",
    "qq_id",
}


class PackageError(ValueError):
    pass


def content_hash(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def validate_business_data(value, depth=0):
    if depth > 20:
        raise PackageError("数据嵌套层数过多。")
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = str(key).lower().replace("-", "_")
            if normalized in SENSITIVE_KEYS or any(part in normalized for part in ("password", "appsecret", "access_key_secret")):
                raise PackageError("迁移文件包含敏感凭据字段。")
            validate_business_data(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            validate_business_data(child, depth + 1)
    elif isinstance(value, float) and not math.isfinite(value):
        raise PackageError("业务数据不能包含非有限数字。")


def _loads(value):
    def reject_constant(value):
        raise PackageError("JSON 不能包含非有限数字。")

    def unique_pairs(pairs):
        result = {}
        for key, item in pairs:
            if key in result:
                raise PackageError("JSON 包含重复字段。")
            result[key] = item
        return result

    return json.loads(value, parse_constant=reject_constant, object_pairs_hook=unique_pairs)


class PackageReader:
    def __init__(self, file):
        self.file = file
        self.archive = None
        self.manifest = {}
        self.identities = set()

    def __enter__(self):
        try:
            self.file.seek(0, 2)
            if self.file.tell() > getattr(settings, "DATA_MIGRATION_MAX_PACKAGE_BYTES", 100 * 1024 * 1024):
                raise PackageError("迁移文件超过大小限制。")
            self.file.seek(0)
            self.archive = zipfile.ZipFile(self.file)
            self._validate_manifest()
            return self
        except (zipfile.BadZipFile, UnicodeError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            if self.archive:
                self.archive.close()
            if isinstance(exc, PackageError):
                raise
            raise PackageError("迁移包格式不合法或文件不完整。") from exc

    def __exit__(self, *_args):
        self.archive.close()

    def _validate_manifest(self):
        infos = self.archive.infolist()
        expected = {"manifest.json", "media.jsonl", "export-report.json"} | {f"data/{kind}.jsonl" for kind in DATASETS}
        names = [info.filename for info in infos]
        if set(names) != expected or len(names) != len(expected):
            raise PackageError("迁移包文件路径缺失、重复或包含不允许的文件。")
        if sum(info.file_size for info in infos) > getattr(settings, "DATA_MIGRATION_MAX_EXPANDED_BYTES", 1024 * 1024 * 1024):
            raise PackageError("迁移包展开后超过大小限制。")
        for info in infos:
            path = PurePosixPath(info.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in info.filename or stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
                raise PackageError("迁移包包含不允许的文件路径或文件类型。")
        if self.archive.getinfo("manifest.json").file_size > 256 * 1024:
            raise PackageError("迁移包清单过大。")
        self.manifest = _loads(self.archive.read("manifest.json"))
        manifest = self.manifest
        if manifest.get("format") != "uhome-team-migration" or manifest.get("schema_version") != 1:
            raise PackageError("不支持的迁移包版本。")
        for name, maximum in (("source_instance_id", 150), ("source_team_id", 64), ("source_team_name", 150), ("export_id", 64)):
            if not isinstance(manifest.get(name), str) or not manifest[name] or len(manifest[name]) > maximum:
                raise PackageError(f"来源清单字段 {name} 不合法。")
        datasets = manifest.get("datasets")
        if not isinstance(datasets, list) or len(datasets) != len(DATASETS) or {item.get("entity_type") for item in datasets if isinstance(item, dict)} != set(DATASETS):
            raise PackageError("迁移包数据集清单不完整。")
        for item in datasets:
            if item.get("path") != f"data/{item['entity_type']}.jsonl":
                raise PackageError("数据集路径不合法。")
            self._validate_file_info(item)
        media = manifest.get("media", {})
        if media.get("path") != "media.jsonl":
            raise PackageError("媒体清单路径不合法。")
        self._validate_file_info(media)

    def _validate_file_info(self, item):
        if not isinstance(item.get("count"), int) or isinstance(item["count"], bool) or not 0 <= item["count"] <= 1_000_000:
            raise PackageError("记录数量不合法。")
        if item.get("size") != self.archive.getinfo(item["path"]).file_size:
            raise PackageError("迁移文件大小与清单不一致。")
        if not isinstance(item.get("sha256"), str) or len(item["sha256"]) != 64:
            raise PackageError("迁移文件缺少校验值。")

    def _rows(self, item):
        checksum = hashlib.sha256()
        count = 0
        try:
            with self.archive.open(item["path"]) as source:
                while line := source.readline(MAX_LINE_BYTES + 1):
                    if len(line) > MAX_LINE_BYTES:
                        raise PackageError("单条记录超过大小限制。")
                    checksum.update(line)
                    if not line.strip():
                        continue
                    row = _loads(line)
                    if not isinstance(row, dict):
                        raise PackageError("迁移记录必须是对象。")
                    count += 1
                    if count > item["count"]:
                        raise PackageError("记录数量与清单不一致。")
                    yield row
        except (zipfile.BadZipFile, UnicodeError, json.JSONDecodeError) as exc:
            raise PackageError("迁移文件损坏或 JSON 记录不合法。") from exc
        if checksum.hexdigest() != item["sha256"] or count != item["count"]:
            raise PackageError("迁移文件校验失败或记录数量不一致。")

    def records(self):
        for item in self.manifest["datasets"]:
            for row in self._rows(item):
                source_id = row.get("source_id")
                kind = row.get("entity_type")
                if kind != item["entity_type"] or not isinstance(source_id, str) or not source_id or len(source_id) > 128 or not isinstance(row.get("data"), dict):
                    raise PackageError("业务记录类型、标识或内容不合法。")
                identity = (kind, source_id)
                if identity in self.identities:
                    raise PackageError("来源记录标识重复。")
                self.identities.add(identity)
                validate_business_data(row["data"])
                if not isinstance(row.get("source_deleted", False), bool):
                    raise PackageError("删除标记必须是布尔值。")
                if "is_delete" in row["data"] and row["data"]["is_delete"] != row.get("source_deleted", False):
                    raise PackageError("业务记录的删除标记不一致。")
                if kind == "team" and source_id != self.manifest["source_team_id"]:
                    raise PackageError("团队记录与来源团队不一致。")
                if kind in {"buildings", "landlords", "staff_team_relations", "house_team_relations", "bill_team_relations", "auth_applications", "settings"}:
                    team_id = row["data"].get("team_id")
                    if team_id is not None and str(team_id) != self.manifest["source_team_id"]:
                        raise PackageError("业务记录不属于来源团队。")
                yield row

    def media(self):
        positions = set()
        for row in self._rows(self.manifest["media"]):
            identity = (row.get("entity_type"), row.get("source_id"))
            if identity not in self.identities:
                raise PackageError("媒体引用不存在的来源记录。")
            field = row.get("field")
            position = row.get("position")
            if field not in {"images", "videos", "logo", "archive"} or type(position) is not int or not 0 <= position <= 1_000_000:
                raise PackageError("媒体字段或顺序不合法。")
            if (field in {"images", "logo"} and row.get("media_type") != "image") or (field == "videos" and row.get("media_type") != "video"):
                raise PackageError("媒体字段与资源类型不一致。")
            key = (*identity, field, position)
            if key in positions:
                raise PackageError("媒体引用位置重复。")
            positions.add(key)
            url = row.get("source_url", "")
            if not isinstance(url, str) or len(url) > 4096:
                raise PackageError("媒体 URL 不合法。")
            parsed = urlsplit(url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password or row.get("media_type") not in {"image", "video", "file"}:
                raise PackageError("媒体 URL 或类型不合法。")
            yield row
