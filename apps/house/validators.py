from __future__ import annotations


def validate_org_scoped_media_refs(*, instance, refs, media_by_id, field):
    """固定媒体字段只允许引用组织目录下的媒体。"""
    org = getattr(instance, "organization", None)
    if org is None:
        return
    prefix = f"uploads/orgs/{org.pk}/"
    invalid = [media.pk for media in media_by_id.values() if not (media.file.name or "").startswith(prefix)]
    if invalid:
        raise ValueError(f"媒体文件必须属于当前组织目录: {invalid}")
