from django.conf import settings
from django.contrib import admin
from django.urls import URLPattern, URLResolver, include, path, re_path

from apps.base.views import DashboardSPAView, H5SPAView, RootLandingView, http_404, http_500, qr_svg
from config.api import api as ninja_api


urlpatterns: list[URLResolver | URLPattern] = [
    path("", RootLandingView.as_view(), name="root-landing"),
    path("accounts/", include("allauth.socialaccount.providers.github.urls")),
    path("accounts/", include("allauth.socialaccount.providers.weixin.urls")),
    path("api/allauth/", include("allauth.headless.urls")),
    path("api/", ninja_api.urls),
    path("-/", include("django_alive.urls")),
    path("admin/", admin.site.urls),
    path("hijack/", include("hijack.urls")),
    path("500/", http_500),
    path("404/", http_404),
    path("qr/", qr_svg, name="qr-svg"),
    re_path(r"^dashboard/", DashboardSPAView.as_view(), name="dashboard-spa"),
    re_path(r"^h5/", H5SPAView.as_view(), name="h5-spa"),
]

if settings.DEBUG is True:
    import debug_toolbar

    urlpatterns.insert(0, path("__debug__/", include(debug_toolbar.urls)))
    urlpatterns.insert(1, path("admin/doc/", include("django.contrib.admindocs.urls")))
