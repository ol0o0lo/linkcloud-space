from io import BytesIO

from django.test import override_settings

import pytest
from PIL import Image

from apps.media.thumbnails import InvalidImageContentError, get_thumbnail_path, is_image_path, render_thumbnail


def make_image(*, size=(120, 80), mode="RGBA") -> BytesIO:
    source = BytesIO()
    color = (10, 20, 30, 128) if mode == "RGBA" else (10, 20, 30)
    Image.new(mode, size, color).save(source, format="PNG")
    source.seek(0)
    return source


def test_render_thumbnail_does_not_upscale_and_preserves_alpha():
    content = render_thumbnail(make_image())

    with Image.open(BytesIO(content.read())) as thumbnail:
        assert thumbnail.format == "WEBP"
        assert thumbnail.size == (120, 80)
        assert thumbnail.mode == "RGBA"


def test_render_thumbnail_applies_exif_orientation():
    source = BytesIO()
    exif = Image.Exif()
    exif[274] = 6
    Image.new("RGB", (40, 80), "red").save(source, format="JPEG", exif=exif)
    source.seek(0)

    content = render_thumbnail(source)

    with Image.open(BytesIO(content.read())) as thumbnail:
        assert thumbnail.size == (80, 40)


def test_render_thumbnail_uses_first_frame_of_animated_webp():
    source = BytesIO()
    first = Image.new("RGB", (20, 10), "red")
    second = Image.new("RGB", (20, 10), "blue")
    first.save(source, format="WEBP", save_all=True, append_images=[second], duration=100, loop=0)
    source.seek(0)

    content = render_thumbnail(source)

    with Image.open(BytesIO(content.read())) as thumbnail:
        assert getattr(thumbnail, "n_frames", 1) == 1


@override_settings(MEDIA_IMAGE_MAX_PIXELS=10)
def test_render_thumbnail_rejects_decompression_bomb_warning():
    with pytest.raises(InvalidImageContentError):
        render_thumbnail(make_image(size=(5, 5), mode="RGB"))


@override_settings(MEDIA_THUMBNAIL_VERSION="v2")
def test_get_thumbnail_path_is_versioned():
    assert get_thumbnail_path(42) == "derived/thumbnails/v2/42.webp"


def test_is_image_path_uses_supported_extensions():
    assert is_image_path("uploads/house.JPG") is True
    assert is_image_path("uploads/lease.pdf") is False
    assert is_image_path("no-extension") is False
