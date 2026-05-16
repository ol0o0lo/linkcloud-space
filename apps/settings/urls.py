from django.urls import path

from apps.settings.views import (
    OrgSettingDetailView,
    OrgSettingListView,
    TeamSettingDetailView,
    TeamSettingListView,
    UserSettingDetailView,
    UserSettingListView,
)

urlpatterns = [
    path("org/", OrgSettingListView.as_view(), name="org-setting-list"),
    path("org/<str:key>/", OrgSettingDetailView.as_view(), name="org-setting-detail"),
    path("teams/<int:team_id>/", TeamSettingListView.as_view(), name="team-setting-list"),
    path("teams/<int:team_id>/<str:key>/", TeamSettingDetailView.as_view(), name="team-setting-detail"),
    path("user/", UserSettingListView.as_view(), name="user-setting-list"),
    path("user/<str:key>/", UserSettingDetailView.as_view(), name="user-setting-detail"),
]
