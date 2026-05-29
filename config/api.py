"""Single ``NinjaAPI`` instance for the project, mounted at ``/api/`` in config/urls.py."""

from django.conf import settings

from allauth.headless.contrib.ninja.security import jwt_token_auth
from ninja import NinjaAPI
from ninja.security import django_auth

from apps.access.api import org_bindings_router as access_org_bindings_router
from apps.access.api import org_roles_router as access_org_roles_router
from apps.access.api import permissions_router as access_permissions_router
from apps.access.api import team_bindings_router as access_team_bindings_router
from apps.access.api import team_roles_router as access_team_roles_router
from apps.accounts.api import users_router
from apps.base.api import router as base_router
from apps.base.errors import register_error_handlers
from apps.media.api import router as media_router
from apps.notifications.api import router as notifications_router
from apps.organizations.api import (
    invites_router as org_invites_router,
)
from apps.organizations.api import (
    members_router as org_members_router,
)
from apps.organizations.api import (
    orgs_router,
    public_invites_router,
)
from apps.organizations.api import (
    settings_router as org_settings_router,
)
from apps.settings.api import org_router as settings_org_router
from apps.settings.api import team_router as settings_team_router
from apps.settings.api import user_router as settings_user_router
from apps.teams.api import router as teams_router

api = NinjaAPI(
    title="Django Base Site API",
    version="1.0.0",
    auth=[django_auth, jwt_token_auth],  # 同时支持 session cookie 和 JWT Bearer token
    docs_url="/docs" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

register_error_handlers(api)

api.add_router("/", base_router)
api.add_router("/media/", media_router)
api.add_router("/access/permissions/", access_permissions_router)
api.add_router("/access/organization-roles/", access_org_roles_router)
api.add_router("/access/organization-bindings/", access_org_bindings_router)
api.add_router("/access/teams/", access_team_roles_router)
api.add_router("/access/teams/", access_team_bindings_router)
api.add_router("/organization-invites/", org_invites_router)
api.add_router("/invite-by-key/", public_invites_router)
api.add_router("/notifications/", notifications_router)
api.add_router("/organization-members/", org_members_router)
api.add_router("/organization-settings/", org_settings_router)
api.add_router("/organizations/", orgs_router)
api.add_router("/teams/", teams_router)
api.add_router("/users/", users_router)
api.add_router("/settings/org/", settings_org_router)
api.add_router("/settings/teams/", settings_team_router)
api.add_router("/settings/user/", settings_user_router)
