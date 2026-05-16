from django.utils.deprecation import MiddlewareMixin
from django.utils.functional import SimpleLazyObject

from apps.organizations.session import get_organization, get_organization_from_header


def _get_organization(request):
    request._cached_organization = getattr(request, "_cached_organization", None)
    if not request._cached_organization:
        # 1. 优先从 session 读（Web SPA，保持原有行为）
        org = get_organization(request)

        # 2. session 无 org 且有 X-Org-Slug header → 小程序/移动端路径
        if not org.pk:
            org = get_organization_from_header(request)

        request._cached_organization = org
    return request._cached_organization


class OrganizationMiddleware(MiddlewareMixin):
    @staticmethod
    def process_request(request):
        assert hasattr(request, "session"), (  # noqa: S101
            "The Django authentication middleware requires session middleware "
            "to be installed. Edit your MIDDLEWARE setting to insert "
            "'django.contrib.sessions.middleware.SessionMiddleware' before "
            "'django.contrib.auth.middleware.AuthenticationMiddleware'."
        )
        request.org = SimpleLazyObject(lambda: _get_organization(request))
