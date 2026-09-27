from apps.base.enums import StrChoices


class ContentEntryKind(StrChoices):
    TOPIC = "topic", "专题活动"
    GUIDE = "guide", "租房指南"


class HomeBannerAction(StrChoices):
    ENTRY = "entry", "专题或指南"
    HOUSE_LIST = "house_list", "条件找房"
    HOUSE_MAP = "house_map", "地图找房"


class HomeBannerTone(StrChoices):
    BLUE = "blue", "蓝色"
    VIOLET = "violet", "紫色"
    TEAL = "teal", "青色"


class ContentEntryTone(StrChoices):
    SAGE = "sage", "青绿"
    LAVENDER = "lavender", "淡紫"
    SLATE = "slate", "灰蓝"
    CLAY = "clay", "暖棕"


class ContentDisplayStatus(StrChoices):
    DISABLED = "disabled", "未启用"
    SCHEDULED = "scheduled", "待开始"
    ACTIVE = "active", "展示中"
    EXPIRED = "expired", "已结束"


ENTRY_TONES_BY_KIND = {
    ContentEntryKind.TOPIC: {ContentEntryTone.SAGE, ContentEntryTone.LAVENDER},
    ContentEntryKind.GUIDE: {ContentEntryTone.SLATE, ContentEntryTone.CLAY},
}
