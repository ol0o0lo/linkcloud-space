import warnings
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile

from PIL import Image, ImageOps, UnidentifiedImageError

from apps.media.constants import IMAGE_EXTENSIONS


class InvalidImageContentError(ValueError):
    """图片内容无法安全解码或生成缩略图。"""


class ImageFileTooLargeError(InvalidImageContentError):
    """图片对象超过允许的字节上限。"""


def is_image_path(path: str) -> bool:
    parts = path.rsplit(".", 1)
    return len(parts) == 2 and parts[1].lower() in IMAGE_EXTENSIONS


def get_thumbnail_path(media_file_id: int) -> str:
    return f"derived/thumbnails/{settings.MEDIA_THUMBNAIL_VERSION}/{media_file_id}.webp"


def render_thumbnail(source) -> ContentFile:
    previous_max_pixels = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = settings.MEDIA_IMAGE_MAX_PIXELS
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(source) as opened:
                opened.seek(0)
                opened.draft(opened.mode, settings.MEDIA_THUMBNAIL_SIZE)
                ImageOps.exif_transpose(opened, in_place=True)
                image = opened
                image.load()
                image.thumbnail(settings.MEDIA_THUMBNAIL_SIZE, Image.Resampling.LANCZOS)

                has_alpha = "A" in image.getbands() or image.info.get("transparency") is not None
                image = image.convert("RGBA" if has_alpha else "RGB")

                output = BytesIO()
                image.save(
                    output,
                    format="WEBP",
                    quality=settings.MEDIA_THUMBNAIL_QUALITY,
                    method=6,
                )
    except (Image.DecompressionBombError, Image.DecompressionBombWarning, UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidImageContentError("图片内容无效，无法生成缩略图") from exc
    finally:
        Image.MAX_IMAGE_PIXELS = previous_max_pixels

    return ContentFile(output.getvalue())


def create_thumbnail_file(media_file) -> str:
    target_path = get_thumbnail_path(media_file.pk)
    storage = media_file.thumbnail.storage
    if storage.exists(target_path):
        return target_path

    actual_size = media_file.file.storage.size(media_file.file.name)
    if actual_size > settings.MEDIA_IMAGE_MAX_FILE_SIZE:
        raise ImageFileTooLargeError("图片文件超过允许的大小上限")

    with media_file.file.open("rb") as source:
        source_bytes = source.read(settings.MEDIA_IMAGE_MAX_FILE_SIZE + 1)
    if len(source_bytes) > settings.MEDIA_IMAGE_MAX_FILE_SIZE:
        raise ImageFileTooLargeError("图片文件超过允许的大小上限")

    content = render_thumbnail(BytesIO(source_bytes))
    return storage.save(target_path, content)
