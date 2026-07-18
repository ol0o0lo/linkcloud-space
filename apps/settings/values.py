from django.core.exceptions import ValidationError


def normalize_tag_list(value, *, strict: bool = True) -> list[str]:
    if not isinstance(value, list):
        if strict:
            raise ValidationError("标签预设必须是字符串列表。")
        return []

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            if strict:
                raise ValidationError("标签预设中的每一项都必须是字符串。")
            continue
        tag = " ".join(item.split())
        if tag and tag not in normalized:
            normalized.append(tag)
    return normalized
