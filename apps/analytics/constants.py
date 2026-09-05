from apps.base.enums import StrChoices


class AnalyticsSource(StrChoices):
    H5 = "h5", "H5"
    MINIPROGRAM = "miniprogram", "微信小程序"
    PUBLIC = "public", "公开页面"
    ADMIN = "admin", "管理端"
    SERVER = "server", "服务端业务"


ANALYTICS_SELECTABLE_SOURCES = (
    AnalyticsSource.H5,
    AnalyticsSource.MINIPROGRAM,
    AnalyticsSource.PUBLIC,
    AnalyticsSource.SERVER,
)

ANALYTICS_PUBLIC_SOURCES = frozenset(
    {
        AnalyticsSource.H5,
        AnalyticsSource.MINIPROGRAM,
        AnalyticsSource.PUBLIC,
    }
)
