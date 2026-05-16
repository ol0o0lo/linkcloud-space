from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.settings.permissions import IsOrgOwner, IsTeamAdminOrOrgOwner
from apps.settings.serializers import (
    SetSettingSerializer,
    SetUserSettingSerializer,
    SettingResultSerializer,
    UserSettingResultSerializer,
)
from apps.settings.service import (
    delete_org_setting,
    delete_team_setting,
    delete_user_setting,
    get_all_org_settings,
    get_all_team_settings,
    get_all_user_settings,
    get_org_setting,
    get_team_setting,
    get_user_setting,
    set_org_setting,
    set_team_setting,
    set_user_setting,
)
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting
from apps.teams.models import Team


class OrgSettingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org = request.org.instance
        results = get_all_org_settings(org)
        return Response(SettingResultSerializer(results, many=True).data)


class OrgSettingDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOrgOwner()]

    def get(self, request, key):
        org = request.org.instance
        try:
            result = get_org_setting(org, key)
        except DefaultSetting.DoesNotExist:
            return Response({"detail": "设置项不存在"}, status=status.HTTP_404_NOT_FOUND)
        return Response(SettingResultSerializer(result).data)

    def put(self, request, key):
        org = request.org.instance
        serializer = SetSettingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            set_org_setting(org, key, serializer.validated_data["value"])
        except DefaultSetting.DoesNotExist:
            return Response({"detail": "设置项不存在"}, status=status.HTTP_404_NOT_FOUND)
        result = get_org_setting(org, key)
        return Response(SettingResultSerializer(result).data)

    def delete(self, request, key):
        org = request.org.instance
        try:
            delete_org_setting(org, key)
        except (DefaultSetting.DoesNotExist, OrganizationSetting.DoesNotExist):
            return Response({"detail": "覆盖设置不存在"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TeamSettingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, team_id):
        team = get_object_or_404(Team, pk=team_id)
        self.check_object_permissions(request, team)
        results = get_all_team_settings(team)
        return Response(SettingResultSerializer(results, many=True).data)


class TeamSettingDetailView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsTeamAdminOrOrgOwner()]

    def _get_team(self, team_id):
        return get_object_or_404(Team, pk=team_id)

    def get(self, request, team_id, key):
        team = self._get_team(team_id)
        try:
            result = get_team_setting(team, key)
        except DefaultSetting.DoesNotExist:
            return Response({"detail": "设置项不存在"}, status=status.HTTP_404_NOT_FOUND)
        return Response(SettingResultSerializer(result).data)

    def put(self, request, team_id, key):
        team = self._get_team(team_id)
        self.check_object_permissions(request, team)
        serializer = SetSettingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            set_team_setting(team, key, serializer.validated_data["value"])
        except DefaultSetting.DoesNotExist:
            return Response({"detail": "设置项不存在"}, status=status.HTTP_404_NOT_FOUND)
        result = get_team_setting(team, key)
        return Response(SettingResultSerializer(result).data)

    def delete(self, request, team_id, key):
        team = self._get_team(team_id)
        self.check_object_permissions(request, team)
        try:
            delete_team_setting(team, key)
        except (DefaultSetting.DoesNotExist, TeamSetting.DoesNotExist):
            return Response({"detail": "覆盖设置不存在"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserSettingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        results = get_all_user_settings(request.user)
        return Response(UserSettingResultSerializer(results, many=True).data)


class UserSettingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, key):
        value = get_user_setting(request.user, key)
        if value is None:
            return Response({"detail": "偏好设置不存在"}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSettingResultSerializer({"key": key, "value": value}).data)

    def put(self, request, key):
        serializer = SetUserSettingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        set_user_setting(request.user, key, serializer.validated_data["value"])
        value = get_user_setting(request.user, key)
        return Response(UserSettingResultSerializer({"key": key, "value": value}).data)

    def delete(self, request, key):
        delete_user_setting(request.user, key)
        return Response(status=status.HTTP_204_NO_CONTENT)
