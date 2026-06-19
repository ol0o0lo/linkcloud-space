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
