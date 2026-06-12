import io
import os
import re

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseBadRequest
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.views import generic
from django.views.decorators.http import require_GET

import qrcode
import qrcode.image.svg


def _static_asset_prefix(asset_subdir: str) -> str:
    return f"{settings.STATIC_URL.rstrip('/')}/{asset_subdir.strip('/')}/"


def _rewrite_index_asset_urls(content: bytes, asset_subdir: str | None = None) -> bytes:
    if not asset_subdir:
        return content

    html = content.decode("utf-8")
    asset_prefix = _static_asset_prefix(asset_subdir)

    def replace_asset_url(match: re.Match[str]) -> str:
        attr = match.group("attr")
        url = match.group("url")
        relative_url = url.removeprefix("/").removeprefix("auto/")
        return f"{attr}{asset_prefix}{relative_url}"

    return re.sub(
        r'(?P<attr>\b(?:src|href)=["\'])(?P<url>/(?!/)[^"\']+|auto/[^"\']+)',
        replace_asset_url,
        html,
    ).encode("utf-8")


def _static_index_response(
    request,
    relative_index_path: str,
    missing_message: str,
    *,
    asset_subdir: str | None = None,
) -> HttpResponse:
    index_path = os.path.join(settings.BASE_DIR, *relative_index_path.split("/"))
    try:
        with open(index_path, "rb") as f:
            content = f.read()
    except FileNotFoundError:
        return HttpResponse(missing_message, status=503)
    content = _rewrite_index_asset_urls(content, asset_subdir)
    get_token(request)
    return HttpResponse(content, content_type="text/html; charset=utf-8")


class DashboardSPAView(generic.View):
    def get(self, request, *args, **kwargs):
        return _static_index_response(
            request,
            "public/static/dist/admin/index.html",
            "Admin frontend not built. Run `just build_admin`.",
            asset_subdir="dist/admin",
        )


class H5SPAView(generic.View):
    def get(self, request, *args, **kwargs):
        return _static_index_response(
            request,
            "public/static/dist/h5/index.html",
            "H5 frontend not built. Run `just build_h5`.",
        )


class RootLandingView(generic.TemplateView):
    template_name = "root_landing.html"


def http_500(request):
    raise Exception


def http_404(request):
    return render(request, "404.html")


@require_GET
@login_required
def qr_svg(request):
    """
    Render a QR code as an inline SVG.

    Used by the SPA to display a TOTP enrollment QR code without depending
    on a third-party image service. Locked to authenticated users so the
    endpoint can't be used as an open QR generator.
    """
    data = request.GET.get("data", "")
    if not data or len(data) > 2048:
        return HttpResponseBadRequest("Missing or oversized 'data' query parameter.")
    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf)
    response = HttpResponse(buf.getvalue(), content_type="image/svg+xml")
    response["Cache-Control"] = "no-store"
    return response
