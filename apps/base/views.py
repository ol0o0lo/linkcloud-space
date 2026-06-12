import io
import os

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, HttpResponseBadRequest
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.views import generic
from django.views.decorators.http import require_GET

import qrcode
import qrcode.image.svg

def _static_index_response(request, relative_index_path: str, missing_message: str) -> HttpResponse:
    index_path = os.path.join(settings.BASE_DIR, *relative_index_path.split("/"))
    try:
        with open(index_path, "rb") as f:
            content = f.read()
    except FileNotFoundError:
        return HttpResponse(missing_message, status=503)
    get_token(request)
    return HttpResponse(content, content_type="text/html; charset=utf-8")


class DashboardSPAView(generic.View):
    def get(self, request, *args, **kwargs):
        return _static_index_response(
            request,
            "public/static/dist/admin/index.html",
            "Admin frontend not built. Run `just build_admin`.",
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
