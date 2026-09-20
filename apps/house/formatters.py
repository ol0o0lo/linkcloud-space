def format_house_layout(bedrooms: int | None, living_rooms: int | None) -> str:
    if bedrooms == 1 and living_rooms == 0:
        return "单间"
    if bedrooms is None and living_rooms is None:
        return ""
    return f"{bedrooms or 0}室{living_rooms or 0}厅"
