# Notification Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-version in-app notification dispatch system where platform admins and tenant admins can create immediate notification sends, Celery performs delivery, and users continue managing their personal notification inbox.

**Architecture:** Add `NotificationDispatch` as the management-side send record and keep `Notification` as the user inbox row. The management API creates dispatches and queues Celery; the worker resolves `scope/scope_ids`, protects tenant ownership with `owner_organization`, and creates `Notification` rows linked back to the dispatch.

**Tech Stack:** Django 5, django-ninja, Celery, pytest, Model Bakery, Vue/React admin frontend under `frontend_admin`, TanStack Query, Ant Design, OpenAPI generated clients.

---

## File Structure

- Create `apps/notifications/dispatches.py`: scope validation, recipient resolution, permission helpers, and dispatch execution service.
- Modify `apps/notifications/models.py`: add `NotificationDispatch` and `Notification.dispatch`.
- Create `apps/notifications/migrations/0004_notification_dispatch.py`: model and nullable FK migration.
- Modify `apps/notifications/tasks.py`: add `dispatch_notification`.
- Modify `apps/notifications/schemas.py`: add dispatch request/response schemas.
- Modify `apps/notifications/api.py`: add `dispatches_router` for `/api/notification-dispatches/`.
- Modify `config/api.py`: mount `dispatches_router`.
- Create `tests/notifications/test_dispatches.py`: service and worker tests.
- Create `tests/notifications/test_dispatches_api.py`: management API permission and behavior tests.
- Modify `frontend_admin/scripts/openapi-codegen-tags.js`: map notification dispatch tag to a generated service name.
- Regenerate `frontend_admin/src/services/openapi/*` with `pnpm --dir frontend_admin openapi`.
- Modify `frontend_admin/src/pages/platform-management/notifications/index.tsx`: rename/position existing page as personal notification center if needed.
- Create `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`: dispatch management page.
- Create `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`: frontend behavior tests.
- Modify `frontend_admin/config/routes.ts`: add the dispatch management route.
- Modify `frontend_admin/src/pages/platform-management/shared.tsx`: add query keys for dispatches.
- Modify locale menu files if this project keeps the new route visible through localized menu labels.

## Task 1: Backend Model And Migration

**Files:**
- Modify: `apps/notifications/models.py`
- Create: `apps/notifications/migrations/0004_notification_dispatch.py`
- Test: `tests/notifications/test_dispatches.py`

- [ ] **Step 1: Write failing model tests**

Add `tests/notifications/test_dispatches.py`:

```python
import pytest
from django.core.exceptions import ValidationError
from model_bakery import baker

from apps.notifications.models import Notification, NotificationDispatch


@pytest.mark.django_db
class TestNotificationDispatchModel:
    def test_platform_scope_requires_empty_scope_ids(self):
        dispatch = NotificationDispatch(scope=NotificationDispatch.Scope.PLATFORM, scope_ids=[1], title="Hello")

        with pytest.raises(ValidationError) as exc:
            dispatch.full_clean()

        assert "scope_ids" in exc.value.message_dict

    def test_non_platform_scope_requires_scope_ids(self):
        dispatch = NotificationDispatch(scope=NotificationDispatch.Scope.USERS, scope_ids=[], title="Hello")

        with pytest.raises(ValidationError) as exc:
            dispatch.full_clean()

        assert "scope_ids" in exc.value.message_dict

    def test_notification_can_link_to_dispatch(self):
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.PLATFORM, scope_ids=[], title="Hello")
        notification = baker.make(Notification, dispatch=dispatch)

        assert notification.dispatch == dispatch
```

- [ ] **Step 2: Run the tests and confirm failure**

Run: `docker compose exec web pytest tests/notifications/test_dispatches.py -v`

Expected: fail with import/model errors because `NotificationDispatch` and `Notification.dispatch` do not exist yet.

- [ ] **Step 3: Add the model fields**

In `apps/notifications/models.py`, import `BaseModelMixin` and add:

```python
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
```

Add above `Notification`:

```python
class NotificationDispatch(BaseModelMixin):
    class Scope(models.TextChoices):
        PLATFORM = "platform", _("Platform")
        ORGANIZATION = "organization", _("Organization")
        USERS = "users", _("Users")

    class Status(models.TextChoices):
        PENDING = "pending", _("Pending")
        SENDING = "sending", _("Sending")
        SENT = "sent", _("Sent")
        FAILED = "failed", _("Failed")

    owner_organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="notification_dispatches",
        null=True,
        blank=True,
        help_text="Management owner; null means platform-owned.",
    )
    scope = models.CharField(max_length=32, choices=Scope.choices)
    scope_ids = models.JSONField(default=list, blank=True)
    category = models.CharField(max_length=64, blank=True, db_index=True)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    url = models.CharField(max_length=500, null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    target_count = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["owner_organization", "-created_at"], name="notif_dispatch_owner_idx"),
            models.Index(fields=["scope", "-created_at"], name="notif_dispatch_scope_idx"),
            models.Index(fields=["status", "-created_at"], name="notif_dispatch_status_idx"),
        ]

    def clean(self):
        super().clean()
        if self.scope == self.Scope.PLATFORM and self.scope_ids:
            raise ValidationError({"scope_ids": "Platform dispatches must not include scope_ids."})
        if self.scope != self.Scope.PLATFORM and not self.scope_ids:
            raise ValidationError({"scope_ids": "Organization and users dispatches require scope_ids."})

    def __str__(self):
        return f"{self.get_scope_display()} notification dispatch: {self.title}"
```

Add to `Notification`:

```python
    dispatch = models.ForeignKey(
        NotificationDispatch,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
        help_text="The management dispatch that produced this inbox row.",
    )
```

- [ ] **Step 4: Create migration**

Run: `docker compose exec web python manage.py makemigrations notifications`

Expected: creates `apps/notifications/migrations/0004_notification_dispatch.py` with `NotificationDispatch` and `Notification.dispatch`.

- [ ] **Step 5: Run model tests**

Run: `docker compose exec web pytest tests/notifications/test_dispatches.py -v`

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/notifications/models.py apps/notifications/migrations/0004_notification_dispatch.py tests/notifications/test_dispatches.py
git commit -m "新增通知分发模型"
```

## Task 2: Dispatch Service And Celery Worker

**Files:**
- Create: `apps/notifications/dispatches.py`
- Modify: `apps/notifications/services.py`
- Modify: `apps/notifications/tasks.py`
- Test: `tests/notifications/test_dispatches.py`

- [ ] **Step 1: Extend failing service tests**

Append to `tests/notifications/test_dispatches.py`:

```python
from apps.accounts.models import User
from apps.notifications.constants import NotificationChannel
from apps.notifications.dispatches import execute_dispatch, resolve_dispatch_recipients
from apps.notifications.models import NotificationPreference
from apps.organizations.models import OrganizationMember


@pytest.mark.django_db
class TestNotificationDispatchExecution:
    def test_resolves_platform_recipients(self):
        users = [User.objects.create_user(username=f"user-{idx}") for idx in range(2)]
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.PLATFORM, scope_ids=[], title="Hello")

        recipients = resolve_dispatch_recipients(dispatch)

        assert {u.pk for u in recipients} == {u.pk for u in users}

    def test_resolves_organization_recipients(self):
        org = baker.make("organizations.Organization")
        member = User.objects.create_user(username="member")
        outsider = User.objects.create_user(username="outsider")
        OrganizationMember.objects.create(organization=org, user=member)
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.ORGANIZATION, scope_ids=[org.pk], title="Hello")

        recipients = resolve_dispatch_recipients(dispatch)

        assert [u.pk for u in recipients] == [member.pk]
        assert outsider.pk not in [u.pk for u in recipients]

    def test_resolves_tenant_owned_users_inside_org_only(self):
        org = baker.make("organizations.Organization")
        member = User.objects.create_user(username="member")
        outsider = User.objects.create_user(username="outsider")
        OrganizationMember.objects.create(organization=org, user=member)
        dispatch = NotificationDispatch.objects.create(owner_organization=org, scope=NotificationDispatch.Scope.USERS, scope_ids=[member.pk, outsider.pk], title="Hello")

        recipients = resolve_dispatch_recipients(dispatch)

        assert [u.pk for u in recipients] == [member.pk]

    def test_execute_dispatch_creates_notifications_and_updates_counts(self, settings):
        settings.NOTIFICATIONS_CATEGORIES = [{"key": "ops", "label": "Ops", "default_channels": (NotificationChannel.IN_APP,)}]
        user = User.objects.create_user(username="alice")
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.USERS, scope_ids=[user.pk], category="ops", title="Hello", body="Body")

        execute_dispatch(dispatch.pk)

        dispatch.refresh_from_db()
        assert dispatch.status == NotificationDispatch.Status.SENT
        assert dispatch.target_count == 1
        assert dispatch.delivered_count == 1
        assert dispatch.sent_at is not None
        assert Notification.objects.get(dispatch=dispatch, recipient=user).title == "Hello"

    def test_execute_dispatch_honors_in_app_preferences(self, settings):
        settings.NOTIFICATIONS_CATEGORIES = [{"key": "ops", "label": "Ops", "default_channels": (NotificationChannel.IN_APP,)}]
        user = User.objects.create_user(username="alice")
        NotificationPreference.objects.create(user=user, category="ops", in_app=False)
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.USERS, scope_ids=[user.pk], category="ops", title="Hello")

        execute_dispatch(dispatch.pk)

        dispatch.refresh_from_db()
        assert dispatch.target_count == 1
        assert dispatch.delivered_count == 0
        assert Notification.objects.filter(dispatch=dispatch).count() == 0
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `docker compose exec web pytest tests/notifications/test_dispatches.py -v`

Expected: fail because `apps.notifications.dispatches` does not exist.

- [ ] **Step 3: Add dispatch service**

Create `apps/notifications/dispatches.py`:

```python
from collections.abc import Iterable

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.notifications.models import Notification, NotificationDispatch
from apps.notifications.services import notify
from apps.organizations.models import Organization, OrganizationMember


def resolve_dispatch_recipients(dispatch: NotificationDispatch) -> list[User]:
    qs = User.objects.filter(is_active=True).order_by("pk")
    if dispatch.scope == NotificationDispatch.Scope.PLATFORM:
        recipients = qs
    elif dispatch.scope == NotificationDispatch.Scope.ORGANIZATION:
        member_user_ids = OrganizationMember.objects.filter(organization_id__in=dispatch.scope_ids).values_list("user_id", flat=True)
        recipients = qs.filter(pk__in=member_user_ids)
    else:
        recipients = qs.filter(pk__in=dispatch.scope_ids)

    if dispatch.owner_organization_id is not None:
        allowed_user_ids = OrganizationMember.objects.filter(organization_id=dispatch.owner_organization_id).values_list("user_id", flat=True)
        recipients = recipients.filter(pk__in=allowed_user_ids)

    return list(recipients.distinct())


def _notification_organization(dispatch: NotificationDispatch) -> Organization | None:
    if dispatch.owner_organization_id is not None:
        return dispatch.owner_organization
    if dispatch.scope == NotificationDispatch.Scope.ORGANIZATION and len(dispatch.scope_ids) == 1:
        return Organization.objects.filter(pk=dispatch.scope_ids[0]).first()
    return None


@transaction.atomic
def execute_dispatch(dispatch_id: int) -> int:
    dispatch = NotificationDispatch.objects.select_for_update().select_related("owner_organization").get(pk=dispatch_id)
    if dispatch.status == NotificationDispatch.Status.SENT:
        return dispatch.delivered_count

    dispatch.status = NotificationDispatch.Status.SENDING
    dispatch.error_message = ""
    dispatch.save(update_fields=["status", "error_message", "updated_at"])

    recipients = resolve_dispatch_recipients(dispatch)
    dispatch.target_count = len(recipients)
    organization = _notification_organization(dispatch)
    notifications = notify(
        recipients,
        title=dispatch.title,
        body=dispatch.body,
        url=dispatch.url,
        organization=organization,
        category=dispatch.category,
        data=dispatch.data,
    )
    Notification.objects.filter(pk__in=[n.pk for n in notifications]).update(dispatch=dispatch)

    dispatch.delivered_count = len(notifications)
    dispatch.status = NotificationDispatch.Status.SENT
    dispatch.sent_at = timezone.now()
    dispatch.save(update_fields=["target_count", "delivered_count", "status", "sent_at", "updated_at"])
    return dispatch.delivered_count
```

- [ ] **Step 4: Add Celery task**

Modify `apps/notifications/tasks.py`:

```python
from apps.notifications.dispatches import execute_dispatch
from apps.notifications.models import Notification, NotificationDispatch
```

Add:

```python
@shared_task
def dispatch_notification(dispatch_id: int) -> int:
    try:
        return execute_dispatch(dispatch_id)
    except Exception as exc:
        NotificationDispatch.objects.filter(pk=dispatch_id).update(
            status=NotificationDispatch.Status.FAILED,
            error_message=str(exc)[:2000],
            updated_at=timezone.now(),
        )
        raise
```

- [ ] **Step 5: Run service tests**

Run: `docker compose exec web pytest tests/notifications/test_dispatches.py -v`

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/notifications/dispatches.py apps/notifications/tasks.py tests/notifications/test_dispatches.py
git commit -m "实现通知分发执行服务"
```

## Task 3: Management API

**Files:**
- Modify: `apps/notifications/schemas.py`
- Modify: `apps/notifications/api.py`
- Modify: `config/api.py`
- Test: `tests/notifications/test_dispatches_api.py`

- [ ] **Step 1: Write failing API tests**

Create `tests/notifications/test_dispatches_api.py`:

```python
import json
import logging

import pytest
from model_bakery import baker

from apps.accounts.models import User
from apps.notifications.models import Notification, NotificationDispatch
from apps.organizations.models import OrganizationMember
from tests.api_helpers import api_data

DISPATCHES_URL = "/api/notification-dispatches/"


def detail_url(pk: int) -> str:
    return f"/api/notification-dispatches/{pk}/"


def notifications_url(pk: int) -> str:
    return f"/api/notification-dispatches/{pk}/notifications/"


@pytest.mark.django_db
class TestNotificationDispatchAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, db, client):
        logging.getLogger("django.request").setLevel(logging.ERROR)
        self.client = client
        self.platform_admin = User.objects.create_superuser(username="root", password="secret")
        self.tenant_admin = User.objects.create_user(username="tenant-admin", password="secret")
        self.member = User.objects.create_user(username="member", password="secret")
        self.outsider = User.objects.create_user(username="outsider", password="secret")
        self.org = baker.make("organizations.Organization")
        OrganizationMember.objects.create(organization=self.org, user=self.tenant_admin, is_owner=True)
        OrganizationMember.objects.create(organization=self.org, user=self.member)

    def post_json(self, data):
        return self.client.post(DISPATCHES_URL, data=json.dumps(data), content_type="application/json")

    def test_platform_admin_can_create_platform_dispatch(self, monkeypatch):
        self.client.force_login(self.platform_admin)
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", lambda dispatch_id: None)

        resp = self.post_json({"scope": "platform", "scope_ids": [], "title": "Hello", "body": "Body"})

        assert resp.status_code == 200
        body = api_data(resp)
        assert body["scope"] == "platform"
        assert body["owner_organization_id"] is None

    def test_tenant_admin_cannot_create_platform_dispatch(self, monkeypatch):
        self.client.force_login(self.tenant_admin)
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", lambda dispatch_id: None)

        resp = self.post_json({"scope": "platform", "scope_ids": [], "title": "Hello"})

        assert resp.status_code == 403

    def test_tenant_admin_can_create_users_dispatch_for_org_member(self, monkeypatch):
        self.client.force_login(self.tenant_admin)
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", lambda dispatch_id: None)

        resp = self.post_json({"scope": "users", "scope_ids": [self.member.pk], "title": "Hello"})

        body = api_data(resp)
        dispatch = NotificationDispatch.objects.get(pk=body["id"])
        assert dispatch.owner_organization_id == self.org.pk

    def test_tenant_admin_cannot_target_outsider(self, monkeypatch):
        self.client.force_login(self.tenant_admin)
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", lambda dispatch_id: None)

        resp = self.post_json({"scope": "users", "scope_ids": [self.outsider.pk], "title": "Hello"})

        assert resp.status_code == 403

    def test_list_is_limited_for_tenant_admin(self):
        owned = NotificationDispatch.objects.create(owner_organization=self.org, scope="organization", scope_ids=[self.org.pk], title="Org")
        NotificationDispatch.objects.create(scope="platform", scope_ids=[], title="Platform")
        self.client.force_login(self.tenant_admin)

        resp = self.client.get(DISPATCHES_URL)

        body = api_data(resp)
        assert body["total"] == 1
        assert body["items"][0]["id"] == owned.pk

    def test_delivery_rows_are_limited_by_dispatch_access(self):
        dispatch = NotificationDispatch.objects.create(owner_organization=self.org, scope="organization", scope_ids=[self.org.pk], title="Org")
        notification = baker.make(Notification, dispatch=dispatch, recipient=self.member, organization=self.org, title="Hello")
        self.client.force_login(self.tenant_admin)

        resp = self.client.get(notifications_url(dispatch.pk))

        body = api_data(resp)
        assert body["items"][0]["id"] == notification.pk
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `docker compose exec web pytest tests/notifications/test_dispatches_api.py -v`

Expected: fail because `/api/notification-dispatches/` is not mounted.

- [ ] **Step 3: Add schemas**

Append to `apps/notifications/schemas.py`:

```python
class NotificationDispatchIn(Schema):
    scope: Literal["platform", "organization", "users"]
    scope_ids: list[int] = []
    category: str = ""
    title: str
    body: str = ""
    url: str | None = None
    data: dict = {}


class NotificationDispatchOut(Schema):
    id: int
    scope: str
    scope_ids: list[int]
    owner_organization_id: int | None = None
    category: str
    title: str
    body: str
    url: str | None = None
    data: dict
    status: str
    target_count: int
    delivered_count: int
    error_message: str
    sent_at: datetime | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Add dispatch router**

In `apps/notifications/api.py`, import:

```python
from apps.notifications.models import Notification, NotificationDispatch, NotificationPreference
from apps.notifications.schemas import NotificationDispatchIn, NotificationDispatchOut
from apps.notifications.tasks import dispatch_notification
from apps.organizations.models import OrganizationMember
```

Add after the existing router:

```python
dispatches_router = Router(tags=["通知分发"])


def _current_owned_org_id(request) -> int | None:
    org = request.org
    if org.id is None:
        return None
    if OrganizationMember.objects.filter(organization_id=org.id, user=request.user, is_owner=True).exists():
        return org.id
    return None


def _can_manage_dispatches(request) -> bool:
    return request.user.is_superuser or _current_owned_org_id(request) is not None


def _dispatch_qs(request):
    qs = NotificationDispatch.objects.select_related("owner_organization")
    if request.user.is_superuser:
        return qs
    org_id = _current_owned_org_id(request)
    if org_id is None:
        raise HttpError(403, "You do not have permission to manage notification dispatches.")
    return qs.filter(owner_organization_id=org_id)


def _validate_dispatch_scope(request, payload: NotificationDispatchIn):
    if request.user.is_superuser:
        return None

    org_id = _current_owned_org_id(request)
    if org_id is None:
        raise HttpError(403, "You do not have permission to manage notification dispatches.")
    if payload.scope == NotificationDispatch.Scope.PLATFORM:
        raise HttpError(403, "Tenant admins cannot create platform dispatches.")
    if payload.scope == NotificationDispatch.Scope.ORGANIZATION and payload.scope_ids != [org_id]:
        raise HttpError(403, "Tenant admins can only target their current organization.")
    if payload.scope == NotificationDispatch.Scope.USERS:
        allowed = set(OrganizationMember.objects.filter(organization_id=org_id, user_id__in=payload.scope_ids).values_list("user_id", flat=True))
        if allowed != set(payload.scope_ids):
            raise HttpError(403, "Tenant admins can only target users in their current organization.")
    return org_id


@dispatches_router.get("/", response=list[NotificationDispatchOut], summary="获取通知分发任务")
@paginate(LegacyPagination)
def list_dispatches(request):
    return _dispatch_qs(request)


@dispatches_router.post("/", response=NotificationDispatchOut, summary="创建通知分发任务")
def create_dispatch(request, payload: NotificationDispatchIn):
    owner_org_id = _validate_dispatch_scope(request, payload)
    dispatch = NotificationDispatch.objects.create(
        owner_organization_id=owner_org_id,
        created_by=request.user.username,
        updated_by=request.user.username,
        **payload.dict(),
    )
    dispatch.full_clean()
    dispatch_notification.delay(dispatch.pk)
    return dispatch


@dispatches_router.get("/{dispatch_id}/", response=NotificationDispatchOut, summary="获取通知分发任务详情")
def get_dispatch(request, dispatch_id: int):
    return get_object_or_404(_dispatch_qs(request), pk=dispatch_id)


@dispatches_router.get("/{dispatch_id}/notifications/", response=list[NotificationOut], summary="获取通知分发投递明细")
@paginate(LegacyPagination)
def list_dispatch_notifications(request, dispatch_id: int):
    dispatch = get_object_or_404(_dispatch_qs(request), pk=dispatch_id)
    return Notification.objects.filter(dispatch=dispatch).select_related("actor", "recipient")
```

- [ ] **Step 5: Mount router**

Modify `config/api.py`:

```python
from apps.notifications.api import dispatches_router as notification_dispatches_router
from apps.notifications.api import router as notifications_router
```

Add:

```python
api.add_router("/notification-dispatches/", notification_dispatches_router)
```

- [ ] **Step 6: Run API tests**

Run: `docker compose exec web pytest tests/notifications/test_dispatches_api.py -v`

Expected: pass.

- [ ] **Step 7: Run full notification tests**

Run: `docker compose exec web pytest tests/notifications -v`

Expected: pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/notifications/schemas.py apps/notifications/api.py config/api.py tests/notifications/test_dispatches_api.py
git commit -m "新增通知分发管理接口"
```

## Task 4: OpenAPI Regeneration And Frontend Route Skeleton

**Files:**
- Modify: `frontend_admin/scripts/openapi-codegen-tags.js`
- Regenerate: `frontend_admin/src/services/openapi/*`
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Modify: `frontend_admin/src/locales/zh-TW/menu.ts`
- Modify: `frontend_admin/src/locales/en-US/menu.ts`
- Modify: `frontend_admin/src/pages/platform-management/shared.tsx`
- Create: `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`
- Test: `frontend_admin/src/routes.test.ts`

- [ ] **Step 1: Add failing route expectation**

Modify `frontend_admin/src/routes.test.ts` to include:

```ts
expect(paths).toContain('/platform-management/notification-dispatches');
```

- [ ] **Step 2: Run route test and confirm failure**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/routes.test.ts
```

Expected: fail because the route is not registered.

- [ ] **Step 3: Map OpenAPI tag**

Modify `frontend_admin/scripts/openapi-codegen-tags.js`:

```js
'通知分发': 'notificationDispatches',
```

- [ ] **Step 4: Regenerate OpenAPI services**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin openapi
```

Expected: generated service file includes `frontend_admin/src/services/openapi/notificationDispatches.ts` and typings for `NotificationDispatchIn/Out`.

- [ ] **Step 5: Add query keys**

Modify `frontend_admin/src/pages/platform-management/shared.tsx`:

```ts
notificationDispatches: (page?: number) => ['platform-management', 'notification-dispatches', page],
notificationDispatchDetail: (id?: number) => ['platform-management', 'notification-dispatch', id],
```

- [ ] **Step 6: Add route**

Modify `frontend_admin/config/routes.ts` under `/platform-management`:

```ts
{
  name: 'notification-dispatches',
  icon: 'notification',
  path: '/platform-management/notification-dispatches',
  component: './platform-management/notification-dispatches',
},
```

- [ ] **Step 7: Add locale labels**

Add to `frontend_admin/src/locales/zh-CN/menu.ts`:

```ts
'menu.platform-management.notification-dispatches': '通知分发',
```

Add to `frontend_admin/src/locales/zh-TW/menu.ts`:

```ts
'menu.platform-management.notification-dispatches': '通知分發',
```

Add to `frontend_admin/src/locales/en-US/menu.ts`:

```ts
'menu.platform-management.notification-dispatches': 'Notification Dispatches',
```

- [ ] **Step 8: Add skeleton page**

Create `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`:

```tsx
import { Card } from 'antd';
import React from 'react';

const NotificationDispatchesPage: React.FC = () => {
  return <Card title="通知分发">通知分发管理</Card>;
};

export default NotificationDispatchesPage;
```

- [ ] **Step 9: Run route test**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/routes.test.ts
```

Expected: pass.

- [ ] **Step 10: Commit**

Run:

```bash
git add frontend_admin/scripts/openapi-codegen-tags.js frontend_admin/src/services/openapi frontend_admin/config/routes.ts frontend_admin/src/locales frontend_admin/src/pages/platform-management/shared.tsx frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx frontend_admin/src/routes.test.ts
git commit -m "接入通知分发前端路由"
```

## Task 5: Frontend Dispatch Management Page

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`
- Create: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`

- [ ] **Step 1: Write failing page test**

Create `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationDispatchesPage from './index';

const { mockList, mockCreate, mockNotifications } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockNotifications: vi.fn(),
}));

vi.mock('@/services/openapi/notificationDispatches', () => ({
  appsNotificationsApiListDispatches: mockList,
  appsNotificationsApiCreateDispatch: mockCreate,
  appsNotificationsApiListDispatchNotifications: mockNotifications,
}));

describe('NotificationDispatchesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockList.mockResolvedValue({ items: [{ id: 1, scope: 'platform', scope_ids: [], title: '系统公告', status: 'sent', target_count: 2, delivered_count: 2, created_at: '2026-06-19T10:00:00+08:00' }], total: 1, page: 1, page_size: 10 });
    mockCreate.mockResolvedValue({ id: 2, scope: 'users', scope_ids: [10], title: '单人通知', status: 'pending' });
    mockNotifications.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
  });

  it('lists dispatches and creates a users dispatch', async () => {
    render(<QueryClientProvider client={queryClient}><NotificationDispatchesPage /></QueryClientProvider>);

    await waitFor(() => expect(screen.getByText('系统公告')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '新建分发' }));
    fireEvent.click(screen.getByLabelText('指定用户'));
    fireEvent.change(screen.getByLabelText('用户 ID'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '单人通知' } });
    fireEvent.change(screen.getByLabelText('内容'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ scope: 'users', scope_ids: [10], title: '单人通知', body: 'hello', category: '', data: {} });
    });
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/platform-management/notification-dispatches/index.test.tsx
```

Expected: fail because page does not list or create dispatches.

- [ ] **Step 3: Implement page**

Replace `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx` with:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Modal, Radio, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import React, { useState } from 'react';
import { AdminToolbar, adminTableScroll, drawerWidthMd, fullWidthStyle, ResponsiveActions, wrapTextStyle } from '@/pages/_shared/adminLayout';
import { appsNotificationsApiCreateDispatch, appsNotificationsApiListDispatchNotifications, appsNotificationsApiListDispatches } from '@/services/openapi/notificationDispatches';
import { platformQueryKeys } from '../shared';

type DispatchFormValues = {
  scope: API.NotificationDispatchIn['scope'];
  scope_ids_text?: string;
  title: string;
  body?: string;
  category?: string;
  url?: string;
};

function parseIds(value?: string) {
  return (value || '').split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0);
}

const NotificationDispatchesPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<API.NotificationDispatchOut | null>(null);
  const [form] = Form.useForm<DispatchFormValues>();
  const dispatchesQuery = useQuery({
    queryKey: platformQueryKeys.notificationDispatches(page),
    queryFn: () => appsNotificationsApiListDispatches({ page, page_size: 10 }),
  });
  const notificationsQuery = useQuery({
    queryKey: ['platform-management', 'notification-dispatch-notifications', detail?.id],
    queryFn: () => appsNotificationsApiListDispatchNotifications({ dispatch_id: detail!.id, page: 1, page_size: 10 }),
    enabled: Boolean(detail),
  });
  const createMutation = useMutation({
    mutationFn: (body: API.NotificationDispatchIn) => appsNotificationsApiCreateDispatch(body),
    onSuccess: async () => {
      setModalOpen(false);
      form.resetFields();
      await dispatchesQuery.refetch();
    },
  });
  const columns: ColumnsType<API.NotificationDispatchOut> = [
    { title: '标题', dataIndex: 'title', width: 220, render: (value) => <span style={wrapTextStyle}>{value}</span> },
    { title: '范围', dataIndex: 'scope', width: 140, render: (value) => <Tag>{value}</Tag> },
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <Tag color={value === 'failed' ? 'red' : value === 'sent' ? 'green' : 'blue'}>{value}</Tag> },
    { title: '目标/送达', dataIndex: 'delivered_count', width: 140, render: (_value, record) => `${record.delivered_count || 0}/${record.target_count || 0}` },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm') },
    { title: '操作', dataIndex: 'actions', width: 120, render: (_value, record) => <ResponsiveActions><a onClick={() => setDetail(record)}>详情</a></ResponsiveActions> },
  ];

  const submit = async () => {
    const values = await form.validateFields();
    await createMutation.mutateAsync({
      scope: values.scope,
      scope_ids: values.scope === 'platform' ? [] : parseIds(values.scope_ids_text),
      title: values.title,
      body: values.body || '',
      category: values.category || '',
      url: values.url || undefined,
      data: {},
    });
  };

  return (
    <Card title="通知分发" extra={<AdminToolbar><Button type="primary" onClick={() => { form.setFieldsValue({ scope: 'users' }); setModalOpen(true); }}>新建分发</Button></AdminToolbar>}>
      <Table rowKey="id" loading={dispatchesQuery.isLoading} columns={columns} dataSource={dispatchesQuery.data?.items || []} scroll={adminTableScroll} pagination={{ current: dispatchesQuery.data?.page || page, pageSize: dispatchesQuery.data?.page_size || 10, total: dispatchesQuery.data?.total || 0, onChange: setPage }} />
      <Modal title="新建分发" open={modalOpen} confirmLoading={createMutation.isPending} onCancel={() => setModalOpen(false)} onOk={submit}>
        <Form form={form} layout="vertical">
          <Form.Item label="范围" name="scope" rules={[{ required: true, message: '请选择范围' }]}>
            <Radio.Group>
              <Radio value="platform">全平台</Radio>
              <Radio value="organization">租户</Radio>
              <Radio value="users">指定用户</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => form.getFieldValue('scope') === 'platform' ? null : (
              <Form.Item label={form.getFieldValue('scope') === 'users' ? '用户 ID' : '租户 ID'} name="scope_ids_text" rules={[{ required: true, message: '请输入 ID，多个用英文逗号分隔' }]}>
                <Input />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item label="类别" name="category"><Input /></Form.Item>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item label="内容" name="body"><Input.TextArea rows={4} /></Form.Item>
          <Form.Item label="链接" name="url"><Input /></Form.Item>
        </Form>
      </Modal>
      <Drawer title="分发详情" open={Boolean(detail)} onClose={() => setDetail(null)} width={drawerWidthMd}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="标题"><span style={wrapTextStyle}>{detail?.title || '-'}</span></Descriptions.Item>
          <Descriptions.Item label="范围">{detail?.scope || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">{detail?.status || '-'}</Descriptions.Item>
          <Descriptions.Item label="送达">{detail ? `${detail.delivered_count || 0}/${detail.target_count || 0}` : '-'}</Descriptions.Item>
          <Descriptions.Item label="错误"><span style={wrapTextStyle}>{detail?.error_message || '-'}</span></Descriptions.Item>
        </Descriptions>
        <Space direction="vertical" style={fullWidthStyle}>
          <Table rowKey="id" size="small" loading={notificationsQuery.isLoading} dataSource={notificationsQuery.data?.items || []} pagination={false} columns={[{ title: '标题', dataIndex: 'title' }, { title: '状态', dataIndex: 'is_read', render: (value) => (value ? '已读' : '未读') }]} />
        </Space>
      </Drawer>
    </Card>
  );
};

export default NotificationDispatchesPage;
```

- [ ] **Step 4: Run page test**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/platform-management/notification-dispatches/index.test.tsx
```

Expected: pass.

- [ ] **Step 5: Run frontend typecheck**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin tsc
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add frontend_admin/src/pages/platform-management/notification-dispatches
git commit -m "实现通知分发管理页面"
```

## Task 6: Personal Notification Center Cleanup And Final Verification

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/notifications/index.tsx`
- Modify: `frontend_admin/src/pages/platform-management/notifications/index.test.tsx`
- Test: backend and frontend suites listed below.

- [ ] **Step 1: Rename user-facing title**

In `frontend_admin/src/pages/platform-management/notifications/index.tsx`, change the main card title from:

```tsx
<Card title="通知中心" extra={<Tag color="gold">未读 {unreadCountQuery.data?.count || 0}</Tag>}>
```

to:

```tsx
<Card title="我的通知" extra={<Tag color="gold">未读 {unreadCountQuery.data?.count || 0}</Tag>}>
```

- [ ] **Step 2: Update test assertion**

In `frontend_admin/src/pages/platform-management/notifications/index.test.tsx`, add after render:

```tsx
expect(screen.getByText('我的通知')).toBeInTheDocument();
```

- [ ] **Step 3: Run personal notification test**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/platform-management/notifications/index.test.tsx
```

Expected: pass.

- [ ] **Step 4: Run backend notification tests**

Run:

```bash
docker compose exec web pytest tests/notifications -v
```

Expected: pass.

- [ ] **Step 5: Run frontend focused tests**

Run:

```bash
nvm use 22
pnpm --dir frontend_admin test src/pages/platform-management/notifications/index.test.tsx src/pages/platform-management/notification-dispatches/index.test.tsx src/routes.test.ts
```

Expected: pass.

- [ ] **Step 6: Run lint/type checks**

Run:

```bash
docker compose exec web ruff check apps/notifications tests/notifications config/api.py
nvm use 22
pnpm --dir frontend_admin tsc
```

Expected: both commands pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add frontend_admin/src/pages/platform-management/notifications/index.tsx frontend_admin/src/pages/platform-management/notifications/index.test.tsx
git commit -m "明确个人通知中心入口"
```

## Self-Review

- Spec coverage: the plan covers `NotificationDispatch`, `Notification.dispatch`, `scope/scope_ids`, `owner_organization`, Celery execution, management API, personal notification center, frontend management page, and tests.
- Placeholder scan: no placeholder markers or vague implementation steps are intentionally left.
- Type consistency: the plan consistently uses `NotificationDispatch`, `dispatch`, `scope`, `scope_ids`, `owner_organization`, `pending/sending/sent/failed`, and `/api/notification-dispatches/`.

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-19-notification-dispatch-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.
