from apps.base.enums import StrChoices


class EstatePropertyType(StrChoices):
    RESIDENTIAL = "residential", "住宅"
    COMMERCIAL = "commercial", "商业"
    INDUSTRIAL = "industrial", "工业"
    MIXED = "mixed", "综合"


class ContactRole(StrChoices):
    LANDLORD = "landlord", "房东"
    TENANT = "tenant", "租客"


class CustomerStage(StrChoices):
    NEW = "new", "新客户"
    CONTACTED = "contacted", "已联系"
    VIEWING = "viewing", "已预约"
    NEGOTIATING = "negotiating", "洽谈中"
    WON = "won", "已成交"
    LOST = "lost", "暂不考虑"


class HouseInquiryStatus(StrChoices):
    NEW = "new", "新咨询"
    PROCESSING = "processing", "处理中"
    CLOSED = "closed", "已关闭"
    SIGNED = "signed", "已成交"


class HouseOrientation(StrChoices):
    SOUTH = "south", "南"
    NORTH = "north", "北"
    EAST = "east", "东"
    WEST = "west", "西"
    SOUTH_NORTH = "south_north", "南北"
    EAST_WEST = "east_west", "东西"


class HouseDecoration(StrChoices):
    RAW = "raw", "毛坯"
    SIMPLE = "simple", "简装"
    FINE = "fine", "精装"
    LUXURY = "luxury", "豪装"


class HouseListingType(StrChoices):
    WHOLE = "whole", "整租"
    SHARED = "shared", "合租"
    APARTMENT = "apartment", "公寓"
    SHORT_TERM = "short_term", "短租"


class HouseStatus(StrChoices):
    LISTED = "listed", "招租中"
    RENTED = "rented", "已出租"
    PAUSED = "paused", "暂不出租"


class HouseMatchMode(StrChoices):
    MANUAL = "manual", "手工配房"
    DYNAMIC = "dynamic", "动态配房"


class HouseCommuteMode(StrChoices):
    METRO = "metro", "地铁"
    EBIKE = "ebike", "电动车"
    BICYCLE = "bicycle", "自行车"
    WALKING = "walking", "步行"
    DRIVING = "driving", "驾车"


class ViewingRecordStatus(StrChoices):
    SCHEDULED = "scheduled", "已预约"
    VIEWED = "viewed", "已带看"
    CANCELED = "canceled", "已取消"
    NO_SHOW = "no_show", "爽约"
    CONVERTED = "converted", "已成交"


class LeaseStatus(StrChoices):
    PENDING = "pending", "待生效"
    ACTIVE = "active", "生效中"
    EXPIRED = "expired", "已到期"
    TERMINATED = "terminated", "已终止"


LEASE_STATUS_TRANSITIONS = {
    LeaseStatus.PENDING: {LeaseStatus.PENDING, LeaseStatus.ACTIVE, LeaseStatus.TERMINATED},
    LeaseStatus.ACTIVE: {LeaseStatus.ACTIVE, LeaseStatus.EXPIRED, LeaseStatus.TERMINATED},
    LeaseStatus.EXPIRED: {LeaseStatus.EXPIRED},
    LeaseStatus.TERMINATED: {LeaseStatus.TERMINATED},
}
