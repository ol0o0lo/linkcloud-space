from rest_framework.permissions import BasePermission

from apps.organizations.models import OrganizationMember
from apps.teams.models import Team


class IsOrgOwner(BasePermission):
    """当前用户是 request.org 的 owner。"""

    def has_permission(self, request, view):
        org = getattr(request, "org", None)
        if org is None:
            return False
        return OrganizationMember.objects.filter(
            organization=org.instance, user=request.user, is_owner=True
        ).exists()


class IsTeamMember(BasePermission):
    """当前用户是指定 team 的成员。"""

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Team):
            return obj.members.filter(pk=request.user.pk).exists()
        return False


class IsTeamAdminOrOrgOwner(BasePermission):
    """当前用户是 team 成员，或是所属 org 的 owner。"""

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Team):
            is_member = obj.members.filter(pk=request.user.pk).exists()
            is_org_owner = OrganizationMember.objects.filter(
                organization=obj.organization, user=request.user, is_owner=True
            ).exists()
            return is_member or is_org_owner
        return False
