"""accounts 业务服务层。"""

import io

from django.core.files.uploadedfile import InMemoryUploadedFile

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PIL_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_UPLOAD_SIZE = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 32 * 1024 * 1024
THUMBNAIL_SIZE = 256


def process_and_save_avatar(user, image_file, crop_data: dict) -> str:
    """裁剪、缩放、存储头像，返回 avatar_url。失败抛 ValueError。"""
    from PIL import Image

    if image_file.content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Unsupported image type. Use JPEG, PNG, or WebP.")
    if image_file.size > MAX_UPLOAD_SIZE:
        raise ValueError("Image must be under 10 MB.")

    crop_box = None
    if crop_data.get("width") and crop_data.get("height"):
        try:
            left = int(crop_data["left"])
            top = int(crop_data["top"])
            width = int(crop_data["width"])
            height = int(crop_data["height"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Invalid crop_data: left/top/width/height must be numbers.") from exc
        crop_box = (left, top, left + width, top + height)

    image_file.seek(0)
    try:
        probe = Image.open(image_file)
        probe_format = probe.format
        probe.verify()
    except Exception as exc:
        raise ValueError("Could not decode the uploaded image.") from exc
    if probe_format not in ALLOWED_PIL_FORMATS:
        raise ValueError("Unsupported image format. Use JPEG, PNG, or WebP.")

    image_file.seek(0)
    try:
        img = Image.open(image_file)
        if (img.width * img.height) > MAX_IMAGE_PIXELS:
            raise ValueError("Image dimensions are too large.")
        img = img.convert("RGB")
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not decode the uploaded image.") from exc

    if crop_box is not None:
        img = img.crop(crop_box)
    img = img.resize((THUMBNAIL_SIZE, THUMBNAIL_SIZE), Image.LANCZOS)
    thumb_io = io.BytesIO()
    img.save(thumb_io, format="JPEG", quality=90)
    thumb_file = InMemoryUploadedFile(thumb_io, None, "thumbnail.jpg", "image/jpeg", thumb_io.tell(), None)

    old_original = user.avatar_original.name if user.avatar_original else None
    old_thumb = user.avatar_thumbnail.name if user.avatar_thumbnail else None
    old_original_storage = user.avatar_original.storage if user.avatar_original else None
    old_thumb_storage = user.avatar_thumbnail.storage if user.avatar_thumbnail else None

    image_file.seek(0)
    user.avatar_original.save(image_file.name, image_file, save=False)
    user.avatar_thumbnail.save("thumbnail.jpg", thumb_file, save=False)
    user.avatar_crop_data = crop_data
    user.save(update_fields=["avatar_original", "avatar_thumbnail", "avatar_crop_data"])

    if old_original and old_original != user.avatar_original.name:
        old_original_storage.delete(old_original)
    if old_thumb and old_thumb != user.avatar_thumbnail.name:
        old_thumb_storage.delete(old_thumb)

    return user.avatar_url


def delete_user_avatar(user) -> None:
    """删除用户头像文件及字段。"""
    if user.avatar_original:
        user.avatar_original.delete(save=False)
    if user.avatar_thumbnail:
        user.avatar_thumbnail.delete(save=False)
    user.avatar_crop_data = None
    user.save(update_fields=["avatar_original", "avatar_thumbnail", "avatar_crop_data"])


def bind_phone_to_user(request, user, phone: str):
    """绑定手机号到 user。若已有其他账号使用此手机号，执行合并。"""
    from django.contrib.auth import get_user_model
    from django.db import transaction

    from allauth.account.internal.flows.login import Login, perform_login
    from allauth.socialaccount.models import SocialAccount

    User = get_user_model()

    if user.phone == phone:
        return user, False

    existing = User.objects.filter(phone=phone).exclude(pk=user.pk).first()
    if existing:
        with transaction.atomic():
            SocialAccount.objects.filter(user=user).update(user=existing)
            user.is_active = False
            user.save(update_fields=["is_active"])
        perform_login(request, Login(user=existing))
        return existing, True
    else:
        user.phone = phone
        user.phone_verified = True
        user.save(update_fields=["phone", "phone_verified"])
        return user, False
