from apps.base.enums import StrChoices


class EstatePropertyType(StrChoices):
    RESIDENTIAL = "residential", "住宅"
    COMMERCIAL = "commercial", "商业"
    INDUSTRIAL = "industrial", "工业"
    MIXED = "mixed", "综合"


class ContactRole(StrChoices):
    LANDLORD = "landlord", "房东"
    TENANT = "tenant", "租客"


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


class HouseStatus(StrChoices):
    VACANT = "vacant", "空置"
    LISTED = "listed", "招租中"
    RENTED = "rented", "已租"
    RENOVATING = "renovating", "装修中"
    INACTIVE = "inactive", "已停用"


HOUSE_ACTIVE_STATUSES = (HouseStatus.VACANT, HouseStatus.LISTED, HouseStatus.RENTED, HouseStatus.RENOVATING)


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
