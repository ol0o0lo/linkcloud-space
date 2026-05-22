from django.urls import path

from apps.media.views import OssTokenView

urlpatterns = [
    path("oss-token/", OssTokenView.as_view(), name="oss-token"),
]
