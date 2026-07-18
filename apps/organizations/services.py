def validate_organization_media_refs(*, instance, refs, media_by_id, field):
    """租户媒体字段只允许引用当前租户目录下的文件。"""
    prefix = f"uploads/orgs/{instance.pk}/"
    invalid = [media.pk for media in media_by_id.values() if not (media.file.name or "").startswith(prefix)]
    if invalid:
        raise ValueError(f"媒体文件必须属于当前租户目录: {invalid}")
