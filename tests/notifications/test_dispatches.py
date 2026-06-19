import pytest
from django.core.exceptions import ValidationError
from model_bakery import baker

from apps.accounts.models import User
from apps.notifications.constants import NotificationChannel
from apps.notifications.dispatches import execute_dispatch, resolve_dispatch_recipients
from apps.notifications.models import Notification, NotificationDispatch
from apps.notifications.models import NotificationPreference
from apps.notifications.tasks import dispatch_notification
from apps.organizations.models import OrganizationMember


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

    def test_scope_ids_must_be_list(self):
        dispatch = NotificationDispatch(scope=NotificationDispatch.Scope.USERS, scope_ids={"id": 1}, title="Hello")

        with pytest.raises(ValidationError) as exc:
            dispatch.full_clean()

        assert "scope_ids" in exc.value.message_dict

    def test_scope_ids_items_must_be_int(self):
        dispatch = NotificationDispatch(scope=NotificationDispatch.Scope.USERS, scope_ids=["1"], title="Hello")

        with pytest.raises(ValidationError) as exc:
            dispatch.full_clean()

        assert "scope_ids" in exc.value.message_dict

    def test_notification_can_link_to_dispatch(self):
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.PLATFORM, scope_ids=[], title="Hello")
        notification = baker.make(Notification, dispatch=dispatch)

        assert notification.dispatch == dispatch


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

    def test_resolves_tenant_owned_organization_scope_from_owner_only(self):
        owner_org = baker.make("organizations.Organization")
        external_org = baker.make("organizations.Organization")
        owner_member = User.objects.create_user(username="owner-member")
        shared_member = User.objects.create_user(username="shared-member")
        external_member = User.objects.create_user(username="external-member")
        OrganizationMember.objects.create(organization=owner_org, user=owner_member)
        OrganizationMember.objects.create(organization=owner_org, user=shared_member)
        OrganizationMember.objects.create(organization=external_org, user=shared_member)
        OrganizationMember.objects.create(organization=external_org, user=external_member)
        dispatch = NotificationDispatch.objects.create(
            owner_organization=owner_org,
            scope=NotificationDispatch.Scope.ORGANIZATION,
            scope_ids=[external_org.pk],
            title="Hello",
        )

        recipients = resolve_dispatch_recipients(dispatch)

        assert [u.pk for u in recipients] == [owner_member.pk, shared_member.pk]

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

    def test_execute_platform_organization_dispatch_creates_rows_per_organization(self, settings):
        settings.NOTIFICATIONS_CATEGORIES = [{"key": "ops", "label": "Ops", "default_channels": (NotificationChannel.IN_APP,)}]
        org_one = baker.make("organizations.Organization")
        org_two = baker.make("organizations.Organization")
        member_one = User.objects.create_user(username="member-one")
        member_two = User.objects.create_user(username="member-two")
        shared_member = User.objects.create_user(username="shared-member")
        OrganizationMember.objects.create(organization=org_one, user=member_one)
        OrganizationMember.objects.create(organization=org_one, user=shared_member)
        OrganizationMember.objects.create(organization=org_two, user=member_two)
        OrganizationMember.objects.create(organization=org_two, user=shared_member)
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.ORGANIZATION, scope_ids=[org_one.pk, org_two.pk], category="ops", title="Hello")

        execute_dispatch(dispatch.pk)

        rows = {(n.organization_id, n.recipient_id) for n in Notification.objects.filter(dispatch=dispatch)}
        assert rows == {
            (org_one.pk, member_one.pk),
            (org_one.pk, shared_member.pk),
            (org_two.pk, member_two.pk),
            (org_two.pk, shared_member.pk),
        }
        dispatch.refresh_from_db()
        assert dispatch.target_count == 4
        assert dispatch.delivered_count == 4

    def test_dispatch_notification_marks_failed_on_error(self, monkeypatch):
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.PLATFORM, scope_ids=[], title="Hello")

        def fail(_dispatch_id):
            raise RuntimeError("boom")

        monkeypatch.setattr("apps.notifications.tasks.execute_dispatch", fail)

        with pytest.raises(RuntimeError, match="boom"):
            dispatch_notification(dispatch.pk)

        dispatch.refresh_from_db()
        assert dispatch.status == NotificationDispatch.Status.FAILED
        assert dispatch.error_message == "boom"

    def test_dispatch_notification_does_not_mark_sent_dispatch_failed(self, monkeypatch):
        dispatch = NotificationDispatch.objects.create(scope=NotificationDispatch.Scope.PLATFORM, scope_ids=[], title="Hello", status=NotificationDispatch.Status.SENT)

        def fail(_dispatch_id):
            raise RuntimeError("boom")

        monkeypatch.setattr("apps.notifications.tasks.execute_dispatch", fail)

        with pytest.raises(RuntimeError, match="boom"):
            dispatch_notification(dispatch.pk)

        dispatch.refresh_from_db()
        assert dispatch.status == NotificationDispatch.Status.SENT
        assert dispatch.error_message == ""
