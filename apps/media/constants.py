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
    MP4 = "mp4", "MP4"
    MOV = "mov", "MOV"
    AVI = "avi", "AVI"
    PDF = "pdf", "PDF"
    DOC = "doc", "DOC"
    DOCX = "docx", "DOCX"


IMAGE_EXTENSIONS = {MediaExtension.JPG, MediaExtension.JPEG, MediaExtension.PNG, MediaExtension.WEBP}
VIDEO_EXTENSIONS = {MediaExtension.MP4, MediaExtension.MOV, MediaExtension.AVI}
CONTRACT_EXTENSIONS = {MediaExtension.PDF, MediaExtension.DOC, MediaExtension.DOCX}


class ResourceType(StrChoices):
    AVATAR = "avatar", _("用户头像")
    ORG_LOGO = "org_logo", _("组织 Logo")
    REAL_NAME_ID_CARD = "real_name_id_card", _("实名认证身份证图片")
    ESTATE_IMAGE = "estate_image", _("项目图片")
    HOUSE_IMAGE = "house_image", _("房源图片")
    HOUSE_VIDEO = "house_video", _("房源视频")
    LEASE_CONTRACT = "lease_contract", _("租约合同")


class MediaType(StrChoices):
    IMAGE = "image", _("图片")
    VIDEO = "video", _("视频")
    FILE = "file", _("文件")


class ThumbnailStatus(StrChoices):
    NOT_REQUESTED = "not_requested", _("未请求")
    PENDING = "pending", _("等待生成")
    PROCESSING = "processing", _("生成中")
    READY = "ready", _("已生成")
    FAILED = "failed", _("生成失败")
