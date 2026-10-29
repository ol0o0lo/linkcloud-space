import hashlib
import io
import json
import zipfile

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


def make_package(records=None, media=None, *, extra_files=None):
    records = records or {}
    files = {}
    datasets = []
    for kind in DATASETS:
        rows = [dict(entity_type=kind, source_id=str(row["id"]), data=row, source_deleted=bool(row.get("is_delete", False))) for row in records.get(kind, [])]
        content = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows).encode()
        path = f"data/{kind}.jsonl"
        files[path] = content
        datasets.append({"path": path, "entity_type": kind, "count": len(rows), "sha256": hashlib.sha256(content).hexdigest(), "size": len(content)})
    media_content = "".join(json.dumps(row) + "\n" for row in media or []).encode()
    files["media.jsonl"] = media_content
    files["manifest.json"] = json.dumps(
        {
            "format": "uhome-team-migration",
            "schema_version": 1,
            "source_instance_id": "legacy-test",
            "source_team_id": "42",
            "source_team_name": "旧团队",
            "export_id": "f3f5fc5e-fb22-4893-a507-ff0ea43b0b9c",
            "snapshot_at": "2026-10-25T08:00:00+00:00",
            "generated_at": "2026-10-25T08:01:00+00:00",
            "source_timezone": "Asia/Shanghai",
            "datasets": datasets,
            "media": {"path": "media.jsonl", "count": len(media or []), "sha256": hashlib.sha256(media_content).hexdigest(), "size": len(media_content)},
            "complete": True,
            "issues_count": 0,
        }
    ).encode()
    files["export-report.json"] = b'{"issues": []}'
    files.update(extra_files or {})
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    result.seek(0)
    result.name = "migration.zip"
    return result


def sample_records():
    return {
        "team": [{"id": 42, "team_name": "旧团队"}],
        "landlords": [{"id": 1, "name": "张房东", "phone": "13800138000"}],
        "buildings": [{"id": 2, "address": "广州测试路 12 号", "name": "测试公寓", "floors": 8, "region": {"province": "广东省", "city": "广州市", "area": "天河区"}}],
        "houses": [
            {
                "id": 3,
                "houseId": "old-house-3",
                "building_id": 2,
                "landlordNew_id": 1,
                "houseNum": "301",
                "rent": "1250.50",
                "area": "32",
                "houseType": {"rooms": 1, "halls": 0, "toilets": 1},
                "floor": {"atFloor": 3, "totalFloor": 8},
                "isRented": False,
            }
        ],
        "bills": [{"id": 4, "house_id": 3, "bill_number": "OLD001", "real_rent": "1250.50", "profit": "300.25", "checked": True, "approved": True}],
    }
