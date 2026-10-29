"""限来源、固定解析地址的媒体搬迁，避免把导入 URL 变成任意网络请求。"""

import http.client
import ipaddress
import mimetypes
import socket
import time
from pathlib import PurePosixPath
from tempfile import SpooledTemporaryFile
from urllib.parse import unquote, urljoin, urlsplit

from django.conf import settings
from django.core.files import File
from django.utils import timezone

from PIL import Image

from apps.data_migration.models import MigrationAsset
from apps.media.constants import MediaScope
from apps.media.services import upload_and_register


class RemoteMediaError(ValueError):
    pass


class MissingRemoteMedia(RemoteMediaError):
    pass


def remote_target(url):
    parsed = urlsplit(url)
    allowed = {host.lower() for host in getattr(settings, "DATA_MIGRATION_ALLOWED_MEDIA_HOSTS", [])}
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.hostname.lower() not in allowed or parsed.username or parsed.password:
        raise RemoteMediaError("资源来源不在允许的旧存储域名中。")
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if port not in {80, 443}:
            raise RemoteMediaError("资源访问端口不允许。")
        addresses = list(dict.fromkeys(item[4][0] for item in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM)))
        if not addresses or any(not ipaddress.ip_address(address).is_global or ipaddress.ip_address(address).is_multicast for address in addresses):
            raise RemoteMediaError("资源域名解析到不允许的网络地址。")
    except ValueError as exc:
        if isinstance(exc, RemoteMediaError):
            raise
        raise RemoteMediaError("资源域名或网络地址不合法。") from exc
    return parsed, addresses[0], port


def open_remote(url):
    """HTTPS 保留原域名用于 SNI/证书校验，TCP 固定到已检查的地址。"""
    for _ in range(4):
        parsed, address, port = remote_target(url)
        connection_class = http.client.HTTPSConnection if parsed.scheme == "https" else http.client.HTTPConnection
        connection = connection_class(parsed.hostname, port=port, timeout=20)
        connection._create_connection = lambda _address, timeout=20, source_address=None, *, ip=address, remote_port=port: socket.create_connection(
            (ip, remote_port), timeout, source_address
        )
        try:
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            connection.request("GET", path, headers={"Accept": "*/*", "User-Agent": "Linkcloud-Migration/1.0"})
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                destination = response.getheader("Location")
                if not destination:
                    raise RemoteMediaError("资源跳转缺少目标地址。")
                url = urljoin(url, destination)
                connection.close()
                continue
            if response.status == 404:
                raise MissingRemoteMedia("旧资源不存在（404）。")
            if response.status in {401, 403}:
                raise RemoteMediaError("旧资源无权访问或签名已过期，请修正来源或补传。")
            if response.status != 200:
                raise OSError(f"旧资源服务响应异常（{response.status}）。")
            return connection, response, url
        except Exception:
            connection.close()
            raise
    raise RemoteMediaError("资源跳转次数过多。")


def migrate_remote_file(asset, token):
    connection, response, final_url = open_remote(asset.source_url)
    maximum = (
        getattr(settings, "MEDIA_IMAGE_MAX_FILE_SIZE", 25 * 1024 * 1024) if asset.media_type == "image" else getattr(settings, "DATA_MIGRATION_MAX_MEDIA_BYTES", 512 * 1024 * 1024)
    )
    filename = PurePosixPath(unquote(urlsplit(final_url).path)).name
    content_type = (response.getheader("Content-Type") or "").split(";", 1)[0].strip().lower()
    if "." not in filename:
        extension = mimetypes.guess_extension(content_type) or ""
        filename = "legacy" + extension
    filename = filename[-200:]
    try:
        length = response.getheader("Content-Length")
        if length and int(length) > maximum:
            raise RemoteMediaError("旧资源超过新版允许的文件大小。")
        expected_prefix = {"image": "image/", "video": "video/"}.get(asset.media_type)
        if expected_prefix and content_type and content_type != "application/octet-stream" and not content_type.startswith(expected_prefix):
            raise RemoteMediaError("旧资源的实际类型与媒体类型不一致。")
        with SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b") as temporary:
            size = 0
            heartbeat = time.monotonic()
            while chunk := response.read(64 * 1024):
                size += len(chunk)
                if size > maximum:
                    raise RemoteMediaError("旧资源超过新版允许的文件大小。")
                temporary.write(chunk)
                if time.monotonic() - heartbeat > 20:
                    if not MigrationAsset.objects.filter(pk=asset.pk, run_token=token).update(heartbeat_at=timezone.now()):
                        raise RemoteMediaError("资源任务租约已失效。")
                    heartbeat = time.monotonic()
            if not size or (length and int(length) != size):
                raise RemoteMediaError("旧资源为空或传输不完整。")
            temporary.seek(0)
            if asset.media_type == "image":
                try:
                    with Image.open(temporary) as source:
                        if source.width * source.height > settings.MEDIA_IMAGE_MAX_PIXELS:
                            raise RemoteMediaError("图片像素超过新版限制。")
                        source.verify()
                except (Image.DecompressionBombError, OSError, ValueError) as exc:
                    if isinstance(exc, RemoteMediaError):
                        raise
                    raise RemoteMediaError("旧图片内容不合法。") from exc
                temporary.seek(0)
            uploader = asset.bindings.select_related("record__batch__created_by").first().record.batch.created_by
            return upload_and_register(
                uploader=uploader, file=File(temporary, name=filename), resource_type=asset.resource_type, scope=MediaScope.ORG, object_id=asset.organization_id
            )
    finally:
        connection.close()


def collect_migration_media_ids():
    return MigrationAsset.objects.filter(media_file__isnull=False, bindings__isnull=False).values_list("media_file_id", flat=True).distinct()
