from django.utils.translation import gettext_lazy as _

from apps.base.enums import StrChoices


class MediaScope(StrChoices):
    USER = "user", _("用户")
    ORG = "org", _("组织")


class MediaExtension(StrChoices):
    JPG = "jpg", "JPG"
    JPEG = "jpeg", "JPEG"
    PNG = "png", "PNG"
    WEBP = "webp", "WebP"


class ResourceType(StrChoices):
    AVATAR = "avatar", _("用户头像")
    ORG_LOGO = "org_logo", _("组织 Logo")
    REAL_NAME_ID_CARD = "real_name_id_card", _("实名认证身份证图片")
