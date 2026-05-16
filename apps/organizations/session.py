import json
from dataclasses import dataclass

from django.apps import apps

REQUIRED_ORG_KEYS = {"pk", "id", "name", "slug", "is_owner"}


@dataclass
class MockedOrg:
    pk: int | None = None
    id: int | None = None
    name: str | None = ""
    slug: str | None = None
    is_owner: bool = False

    def __str__(self):
        """Return the organization name."""
        return self.name

    @property
    def instance(self):
        self._instance = getattr(self, "_instance", None)
        if self._instance is None and self.pk is not None:
            org_model = apps.get_model("organizations.Organization")
            self._instance = org_model.objects.filter(pk=self.pk).first()
        return self._instance


def is_org_missing_keys(org: dict):
    return bool(REQUIRED_ORG_KEYS - set(org.keys()))


def get_organization(request):
    session = request.session if hasattr(request, "session") else {}
    org_data = json.loads(session.get("organization_data", "{}"))
    if org_data and is_org_missing_keys(org_data):
        remove_org(request)
        return {}

    org = MockedOrg(**org_data)

    return org


def get_member_count(request):
    return json.loads(request.session.get("org_member_count", "0"))


def get_owner_count(request):
    return json.loads(request.session.get("org_owner_count", "0"))


def save_counts(request):
    org_count = apps.get_model("organizations.Organization").objects.get_user_org_count(request.user)
    request.session["org_member_count"] = str(org_count["member_count"])
    request.session["org_owner_count"] = str(org_count["owner_count"])


def save_org(request, org):
    data = {k: getattr(org, k) for k in REQUIRED_ORG_KEYS if k != "is_owner"}
    data["is_owner"] = org.is_owner(request.user)
    request.session["organization_data"] = json.dumps(data)


def save_org_data(request, org):
    save_counts(request)
    save_org(request, org)


def remove_org(request):
    save_counts(request)

    underlying = getattr(request, "_request", request)
    if hasattr(underlying, "org"):
        delattr(underlying, "org")

    if "organization_data" in request.session:
        del request.session["organization_data"]


def get_organization_from_header(request) -> MockedOrg:
    """
    从 X-Org-Slug 请求头解析 org，用于无 session 的端（小程序、移动端等）。

    要求 request.user 已经通过 JWT 认证（AuthenticationMiddleware 之后调用）。
    如果 slug 无效或 user 不是成员，返回空 MockedOrg（后续 require_org_* 会报 403）。
    """
    slug = request.headers.get("X-Org-Slug", "").strip()
    if not slug:
        return MockedOrg()

    if not (hasattr(request, "user") and request.user.is_authenticated):
        return MockedOrg()

    org_model = apps.get_model("organizations.Organization")
    org = org_model.objects.filter(slug=slug).first()
    if org is None:
        return MockedOrg()

    # 验证成员身份（防止越权访问其他 org）
    member_model = apps.get_model("organizations.OrganizationMember")
    membership = member_model.objects.filter(organization=org, user=request.user).first()
    if membership is None:
        return MockedOrg()

    return MockedOrg(
        pk=org.pk,
        id=org.pk,
        name=org.name,
        slug=org.slug,
        is_owner=membership.is_owner,
    )
