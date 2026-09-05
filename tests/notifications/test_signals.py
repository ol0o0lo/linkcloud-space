from django.db.models.signals import post_delete

import pytest
from model_bakery import baker

from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.notifications.signals import _delete_notifications_for_target, connect_target_receivers
from apps.organizations.models import Organization, OrganizationMember
from apps.teams.models import Team


@pytest.mark.django_db
class TestTargetDeleteCascade:
    """
    Pin the GenericForeignKey post_delete cascade contract.

    Notification.target is a GenericForeignKey — the database has no FK CASCADE.
    `connect_target_receivers()` wires a per-model post_delete signal so deleting
    the target row cleans up its notifications. If the wiring or the signal
    handler regresses, this test fails before notifications leak in production.
    """

    @pytest.fixture(autouse=True)
    def _setup(self, db, settings):
        settings.NOTIFICATIONS_TARGET_MODELS = ["teams.Team"]
        connect_target_receivers()
        self.alice = User.objects.create_user(username="alice", password="secret")  # noqa: S106
        self.organization = baker.make(Organization)
        OrganizationMember.objects.create(organization=self.organization, user=self.alice)
        self.target = baker.make(Team, organization=self.organization)
        yield
        post_delete.disconnect(
            _delete_notifications_for_target,
            sender=Team,
            dispatch_uid="notifications.cascade.teams.Team",
        )

    def test_target_delete_cleans_up_notifications(self):
        notify([self.alice], title="about the team", target=self.target, organization=self.organization)
        assert Notification.objects.count() == 1
        self.target.delete()
        assert Notification.objects.count() == 0

    def test_unrelated_target_delete_leaves_notifications_alone(self):
        other_target = baker.make(Team, organization=self.organization)
        notify([self.alice], title="about target", target=self.target, organization=self.organization)
        other_target.delete()
        assert Notification.objects.count() == 1
