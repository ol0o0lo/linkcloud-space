from django.utils.translation import gettext_lazy as _

from apps.base.enums import ChoicesMixin


class MediaScope(ChoicesMixin):
    USER = "user", _("用户")
    ORG = "org", _("组织")


class MediaExtension(ChoicesMixin):
    JPG = "jpg", "JPG"
    JPEG = "jpeg", "JPEG"
    PNG = "png", "PNG"
    WEBP = "webp", "WebP"
