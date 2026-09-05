import json
from datetime import timedelta

from django.contrib.auth import user_logged_in
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

import pytest
from model_bakery import baker

from apps.access.constants import AccessScope
from apps.access.models import OrganizationGroupBinding, TeamGroupBinding
from apps.accounts.models import User
from apps.notifications.models import Notification, NotificationPreference
from apps.organizations.models import OrganizationMember
from apps.organizations.signals import user_logged_in_receiver
from apps.team_operations.constants import AnnouncementStatus, TaskAssignmentStatus, WorkTaskStatus
from apps.team_operations.models import AnnouncementReceipt, TaskAssignment, TeamAnnouncement, WorkTask
from apps.team_operations.services import daily_dashboard
from tests.access.helpers import make_access_group
from tests.api_helpers import api_data, api_error

BASE_URL = "/api/team-operations/"


def set_session_org(client, org, *, is_owner=False):
    session = client.session
    session["organization_data"] = json.dumps({"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": is_owner})
    session.save()


@pytest.mark.django_db
class TestTeamOperationsAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        user_logged_in.disconnect(user_logged_in_receiver)
        try:
            self.client = client
            self.owner = User.objects.create_user(username="ops-owner", password="secret")  # noqa: S106
            self.member = User.objects.create_user(username="ops-member", first_name="执行", last_name="员工", password="secret")  # noqa: S106
            self.other_member = User.objects.create_user(username="ops-other", password="secret")  # noqa: S106
            self.outsider = User.objects.create_user(username="ops-outsider", password="secret")  # noqa: S106
            self.org = baker.make("organizations.Organization", name="团队运营组织", slug="team-operations-org")
            self.other_org = baker.make("organizations.Organization", name="其他组织", slug="team-operations-other")
            OrganizationMember.objects.create(organization=self.org, user=self.owner, is_owner=True)
            OrganizationMember.objects.create(organization=self.org, user=self.member)
            OrganizationMember.objects.create(organization=self.org, user=self.other_member)
            OrganizationMember.objects.create(organization=self.other_org, user=self.outsider)
            self.team = baker.make("teams.Team", organization=self.org, name="运营一组")
            self.team.members.add(self.member)
            self._login(self.owner, is_owner=True)
            yield
        finally:
            user_logged_in.connect(user_logged_in_receiver)

    def _login(self, user, *, is_owner=False):
        self.client.force_login(user)
        set_session_org(self.client, self.org, is_owner=is_owner)

    def _post(self, path, data=None):
        return self.client.post(f"{BASE_URL}{path}", data=json.dumps(data or {}), content_type="application/json")

    def test_publish_team_announcement_creates_receipt_and_targeted_notification(self):
        create_response = self._post(
            "announcements/",
            {
                "team_id": self.team.pk,
                "title": "今日安排",
                "body": "请处理待办事项",
                "require_acknowledgement": True,
            },
        )
        assert create_response.status_code == 201
        announcement_id = api_data(create_response)["id"]

        publish_response = self._post(f"announcements/{announcement_id}/publish/")

        assert publish_response.status_code == 200
        published = api_data(publish_response)
        assert published["status"] == AnnouncementStatus.PUBLISHED
        assert published["can_manage"] is True
        assert published["is_recipient"] is False
        assert published["recipient_count"] == 1
        assert published["acknowledged_count"] == 0
        assert AnnouncementReceipt.objects.filter(announcement_id=announcement_id, recipient=self.member).exists()
        assert not AnnouncementReceipt.objects.filter(announcement_id=announcement_id, recipient=self.other_member).exists()
        notification = Notification.objects.get(recipient=self.member)
        assert notification.category == "team.announcement"
        assert notification.target_content_type == ContentType.objects.get_for_model(TeamAnnouncement)
        assert notification.target_object_id == announcement_id

    def test_published_announcement_audience_is_a_snapshot(self):
        create_response = self._post(
            "announcements/",
            {
                "team_id": self.team.pk,
                "title": "历史接收范围",
                "body": "发布后不随团队成员变化",
                "require_acknowledgement": True,
            },
        )
        announcement_id = api_data(create_response)["id"]
        assert self._post(f"announcements/{announcement_id}/publish/").status_code == 200

        self.team.members.remove(self.member)
        self.team.members.add(self.other_member)

        self._login(self.member)
        detail_response = self.client.get(f"{BASE_URL}announcements/{announcement_id}/")
        acknowledge_response = self._post(f"announcements/{announcement_id}/acknowledge/")

        assert detail_response.status_code == 200
        assert api_data(detail_response)["is_recipient"] is True
        assert api_data(detail_response)["can_manage"] is False
        assert acknowledge_response.status_code == 200

        self._login(self.other_member)
        assert self.client.get(f"{BASE_URL}announcements/{announcement_id}/").status_code == 404
        assert self._post(f"announcements/{announcement_id}/acknowledge/").status_code == 404

    def test_publish_announcement_ignores_stale_non_org_team_members(self):
        self.team.members.add(self.outsider)
        create_response = self._post(
            "announcements/",
            {
                "team_id": self.team.pk,
                "title": "合法接收人",
                "body": "残留关系不能阻断通知",
                "require_acknowledgement": True,
            },
        )
        announcement_id = api_data(create_response)["id"]

        publish_response = self._post(f"announcements/{announcement_id}/publish/")

        assert publish_response.status_code == 200
        assert api_data(publish_response)["recipient_count"] == 1
        assert AnnouncementReceipt.objects.filter(announcement_id=announcement_id, recipient=self.member).exists()
        assert not AnnouncementReceipt.objects.filter(announcement_id=announcement_id, recipient=self.outsider).exists()
        assert Notification.objects.filter(recipient=self.member, category="team.announcement").exists()
        assert not Notification.objects.filter(recipient=self.outsider, category="team.announcement").exists()

    def test_withdraw_announcement_redacts_notification_and_keeps_receipt_counts(self):
        create_response = self._post(
            "announcements/",
            {
                "team_id": self.team.pk,
                "title": "临时安排",
                "body": "这段正文撤回后不可继续查看",
                "require_acknowledgement": True,
            },
        )
        announcement_id = api_data(create_response)["id"]
        assert self._post(f"announcements/{announcement_id}/publish/").status_code == 200
        notification = Notification.objects.get(recipient=self.member, category="team.announcement")

        withdraw_response = self._post(f"announcements/{announcement_id}/withdraw/")

        assert withdraw_response.status_code == 200
        withdrawn = api_data(withdraw_response)
        assert withdrawn["status"] == AnnouncementStatus.WITHDRAWN
        assert withdrawn["recipient_count"] == 1
        notification.refresh_from_db()
        assert notification.title == "团队公告已撤回"
        assert notification.body == ""
        assert notification.url is None
        assert notification.data == {"kind": "announcement", "announcement_id": announcement_id, "withdrawn": True}
        assert notification.read_at is not None

        self._login(self.member)
        assert self.client.get(f"{BASE_URL}announcements/{announcement_id}/").status_code == 404

    def test_draft_announcement_cannot_be_withdrawn(self):
        create_response = self._post(
            "announcements/",
            {
                "team_id": self.team.pk,
                "title": "尚未发布",
                "body": "草稿不能走撤回动作",
            },
        )
        announcement_id = api_data(create_response)["id"]

        response = self._post(f"announcements/{announcement_id}/withdraw/")

        assert response.status_code == 422
        assert TeamAnnouncement.objects.get(pk=announcement_id).status == AnnouncementStatus.DRAFT

    def test_member_acknowledges_own_announcement_and_notification_becomes_read(self):
        announcement = baker.make(
            TeamAnnouncement,
            organization=self.org,
            team=self.team,
            status=AnnouncementStatus.PUBLISHED,
            require_acknowledgement=True,
            published_at=timezone.now(),
        )
        receipt = AnnouncementReceipt.objects.create(announcement=announcement, recipient=self.member)
        notification = baker.make(Notification, recipient=self.member, organization=self.org, target=announcement, category="team.announcement")
        self._login(self.member)

        response = self._post(f"announcements/{announcement.pk}/acknowledge/")

        assert response.status_code == 200
        receipt.refresh_from_db()
        notification.refresh_from_db()
        assert receipt.acknowledged_at is not None
        assert notification.read_at is not None

    def test_user_outside_announcement_audience_cannot_acknowledge(self):
        announcement = baker.make(
            TeamAnnouncement,
            organization=self.org,
            team=self.team,
            status=AnnouncementStatus.PUBLISHED,
            require_acknowledgement=True,
            published_at=timezone.now(),
        )
        self._login(self.other_member)

        response = self._post(f"announcements/{announcement.pk}/acknowledge/")

        assert response.status_code == 404

    def test_create_task_assigns_member_and_sends_notification(self):
        response = self._post(
            "tasks/",
            {
                "team_id": self.team.pk,
                "title": "核对房源资料",
                "description": "补齐缺失图片",
                "priority": "high",
                "due_at": (timezone.now() + timedelta(days=1)).isoformat(),
                "assignee_ids": [self.member.pk],
            },
        )

        assert response.status_code == 201
        task = WorkTask.objects.get()
        assignment = TaskAssignment.objects.get(task=task, assignee=self.member)
        assert assignment.status == TaskAssignmentStatus.PENDING
        notification = Notification.objects.get(recipient=self.member)
        assert notification.category == "team.task.assigned"
        assert notification.target_object_id == assignment.pk
        assert api_data(response)["assignments"][0]["assignee"]["id"] == self.member.pk

    def test_task_rejects_non_team_assignee(self):
        response = self._post(
            "tasks/",
            {
                "team_id": self.team.pk,
                "title": "非法分配",
                "assignee_ids": [self.other_member.pk],
            },
        )

        assert response.status_code == 422
        assert "团队" in api_error(response)["message"]
        assert WorkTask.objects.count() == 0

    def test_task_summary_and_due_state_filters_use_full_visible_queryset(self):
        now = timezone.now()
        due_soon = baker.make(
            WorkTask,
            organization=self.org,
            team=self.team,
            creator=self.owner,
            title="重点巡检任务",
            description="需要重点关注",
            priority="urgent",
            due_at=now + timedelta(hours=1),
        )
        overdue = baker.make(
            WorkTask,
            organization=self.org,
            team=self.team,
            creator=self.owner,
            title="重点逾期任务",
            priority="urgent",
            due_at=now - timedelta(hours=1),
        )
        baker.make(
            WorkTask,
            organization=self.org,
            team=self.team,
            creator=self.owner,
            title="重点已完成任务",
            priority="urgent",
            status=WorkTaskStatus.COMPLETED,
            due_at=now + timedelta(hours=1),
        )
        baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner, title="普通未来任务", due_at=now + timedelta(days=2))

        summary_response = self.client.get(f"{BASE_URL}tasks/summary/?priority=urgent&keyword=重点")
        due_soon_response = self.client.get(f"{BASE_URL}tasks/?due_state=due_soon&page=1&page_size=100")
        overdue_response = self.client.get(f"{BASE_URL}tasks/?due_state=overdue&page=1&page_size=100")

        assert summary_response.status_code == 200
        assert api_data(summary_response) == {"total": 3, "active": 2, "due_soon": 1, "overdue": 1}
        assert [item["id"] for item in api_data(due_soon_response)["items"]] == [due_soon.pk]
        assert [item["id"] for item in api_data(overdue_response)["items"]] == [overdue.pk]

    def test_assignment_summary_filters_list_and_exposes_creator(self):
        now = timezone.now()
        due_soon_task = baker.make(
            WorkTask,
            organization=self.org,
            team=self.team,
            creator=self.owner,
            title="目标待接受任务",
            priority="high",
            due_at=now + timedelta(hours=1),
        )
        due_soon_assignment = TaskAssignment.objects.create(task=due_soon_task, assignee=self.member)
        overdue_task = baker.make(
            WorkTask,
            organization=self.org,
            team=self.team,
            creator=self.owner,
            title="目标进行中任务",
            priority="high",
            due_at=now - timedelta(hours=1),
        )
        TaskAssignment.objects.create(task=overdue_task, assignee=self.member, status=TaskAssignmentStatus.IN_PROGRESS)
        completed_task = baker.make(
            WorkTask,
            organization=self.org,
            team=self.team,
            creator=self.owner,
            title="目标已完成任务",
            priority="high",
            status=WorkTaskStatus.COMPLETED,
            due_at=now + timedelta(hours=1),
        )
        TaskAssignment.objects.create(task=completed_task, assignee=self.member, status=TaskAssignmentStatus.COMPLETED)
        self._login(self.member)

        summary_response = self.client.get(f"{BASE_URL}task-assignments/summary/?team_id={self.team.pk}&priority=high&keyword=目标")
        list_response = self.client.get(f"{BASE_URL}task-assignments/?due_state=due_soon&keyword=目标&page=1&page_size=100")

        assert summary_response.status_code == 200
        assert api_data(summary_response) == {"pending": 1, "in_progress": 1, "due_soon": 1, "overdue": 1}
        items = api_data(list_response)["items"]
        assert [item["id"] for item in items] == [due_soon_assignment.pk]
        assert items[0]["creator"]["id"] == self.owner.pk

    def test_assignment_list_orders_overdue_then_deadline_and_priority(self):
        now = timezone.now()
        overdue_task = baker.make(WorkTask, organization=self.org, creator=self.owner, priority="normal", due_at=now - timedelta(hours=1))
        overdue_assignment = TaskAssignment.objects.create(task=overdue_task, assignee=self.member)
        due_at = now + timedelta(hours=1)
        normal_task = baker.make(WorkTask, organization=self.org, creator=self.owner, priority="normal", due_at=due_at)
        normal_assignment = TaskAssignment.objects.create(task=normal_task, assignee=self.member)
        urgent_task = baker.make(WorkTask, organization=self.org, creator=self.owner, priority="urgent", due_at=due_at)
        urgent_assignment = TaskAssignment.objects.create(task=urgent_task, assignee=self.member)
        no_due_task = baker.make(WorkTask, organization=self.org, creator=self.owner, priority="urgent", due_at=None)
        no_due_assignment = TaskAssignment.objects.create(task=no_due_task, assignee=self.member)
        self._login(self.member)

        response = self.client.get(f"{BASE_URL}task-assignments/?page=1&page_size=100")

        assert response.status_code == 200
        assert [item["id"] for item in api_data(response)["items"]] == [
            overdue_assignment.pk,
            urgent_assignment.pk,
            normal_assignment.pk,
            no_due_assignment.pk,
        ]

    def test_task_summary_respects_team_manager_scope(self):
        group = make_access_group("team_operations_summary_manager", AccessScope.TEAM, [("team_operations", "task_manage")])
        TeamGroupBinding.objects.create(team=self.team, user=self.member, group=group)
        baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        other_team = baker.make("teams.Team", organization=self.org, name="其他团队")
        baker.make(WorkTask, organization=self.org, team=other_team, creator=self.owner)
        self._login(self.member)

        response = self.client.get(f"{BASE_URL}tasks/summary/")

        assert response.status_code == 200
        assert api_data(response)["total"] == 1

    def test_team_manager_capabilities_and_assignees_are_team_scoped(self):
        group = make_access_group(
            "team_operations_team_manager",
            AccessScope.TEAM,
            [
                ("team_operations", "announcement_manage"),
                ("team_operations", "task_manage"),
            ],
        )
        TeamGroupBinding.objects.create(team=self.team, user=self.member, group=group)
        self._login(self.member)

        capabilities_response = self.client.get(f"{BASE_URL}capabilities/")
        assignees_response = self.client.get(f"{BASE_URL}task-assignees/?team_id={self.team.pk}&page=1&page_size=100")
        organization_assignees_response = self.client.get(f"{BASE_URL}task-assignees/?page=1&page_size=100")

        assert capabilities_response.status_code == 200
        capabilities = api_data(capabilities_response)
        assert capabilities == {
            "announcement_organization_manage": False,
            "announcement_team_ids": [self.team.pk],
            "task_organization_manage": False,
            "task_team_ids": [self.team.pk],
        }
        assert assignees_response.status_code == 200
        assert [item["id"] for item in api_data(assignees_response)["items"]] == [self.member.pk]
        assert organization_assignees_response.status_code == 403

    def test_org_task_manager_can_list_assignees_without_member_view_permission(self):
        group = make_access_group(
            "team_operations_org_task_manager",
            AccessScope.ORG,
            [("team_operations", "task_manage")],
        )
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.member, group=group)
        self._login(self.member)

        member_list_response = self.client.get("/api/organization-members/?page=1&page_size=100")
        assignees_response = self.client.get(f"{BASE_URL}task-assignees/?page=1&page_size=100")

        assert member_list_response.status_code == 403
        assert assignees_response.status_code == 200
        assert {item["id"] for item in api_data(assignees_response)["items"]} == {self.owner.pk, self.member.pk, self.other_member.pk}

    def test_assignee_accepts_and_completes_task(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
        notification = baker.make(Notification, recipient=self.member, organization=self.org, target=assignment, category="team.task.assigned")
        self._login(self.member)

        accept_response = self._post(f"task-assignments/{assignment.pk}/accept/")
        complete_response = self._post(f"task-assignments/{assignment.pk}/complete/", {"result": "资料已补齐"})

        assert accept_response.status_code == 200
        assert complete_response.status_code == 200
        assignment.refresh_from_db()
        task.refresh_from_db()
        notification.refresh_from_db()
        assert assignment.status == TaskAssignmentStatus.COMPLETED
        assert assignment.result == "资料已补齐"
        assert task.status == WorkTaskStatus.COMPLETED
        assert notification.read_at is not None
        creator_notification = Notification.objects.get(recipient=self.owner, category="team.task.completed")
        assert creator_notification.url == f"/dashboard/rental/workbench/tasks?task_id={task.pk}"
        assert creator_notification.data == {"kind": "task", "task_id": task.pk, "assignment_id": assignment.pk}

    def test_assignee_can_open_assignment_from_notification_target(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
        self._login(self.member)

        response = self.client.get(f"{BASE_URL}task-assignments/{assignment.pk}/")

        assert response.status_code == 200
        assert api_data(response)["id"] == assignment.pk

        self._login(self.other_member)
        assert self.client.get(f"{BASE_URL}task-assignments/{assignment.pk}/").status_code == 404

    def test_existing_assignment_can_continue_after_assignee_leaves_team(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
        self.team.members.remove(self.member)
        self._login(self.member)

        accept_response = self._post(f"task-assignments/{assignment.pk}/accept/")
        complete_response = self._post(f"task-assignments/{assignment.pk}/complete/", {"result": "历史任务已处理"})

        assert accept_response.status_code == 200
        assert complete_response.status_code == 200
        assignment.refresh_from_db()
        assert assignment.status == TaskAssignmentStatus.COMPLETED

    def test_removed_org_member_cannot_use_stale_team_operations_session(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        TaskAssignment.objects.create(task=task, assignee=self.member)
        self._login(self.member)
        OrganizationMember.objects.filter(organization=self.org, user=self.member).delete()

        response = self.client.get(f"{BASE_URL}task-assignments/")

        assert response.status_code == 403

    def test_deleting_team_preserves_published_announcements_and_tasks(self):
        announcement = baker.make(
            TeamAnnouncement,
            organization=self.org,
            team=self.team,
            status=AnnouncementStatus.PUBLISHED,
            require_acknowledgement=True,
            published_at=timezone.now(),
        )
        AnnouncementReceipt.objects.create(announcement=announcement, recipient=self.member)
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        TaskAssignment.objects.create(task=task, assignee=self.member)

        delete_response = self.client.delete(f"/api/teams/{self.team.pk}/")

        assert delete_response.status_code == 200
        self._login(self.member)
        announcement_response = self.client.get(f"{BASE_URL}announcements/{announcement.pk}/")
        task_response = self.client.get(f"{BASE_URL}tasks/{task.pk}/")
        assert announcement_response.status_code == 200
        assert api_data(announcement_response)["team_id"] is None
        assert task_response.status_code == 200
        assert api_data(task_response)["team_id"] is None

    def test_other_member_cannot_transition_assignment(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
        self._login(self.other_member)

        response = self._post(f"task-assignments/{assignment.pk}/accept/")

        assert response.status_code == 404
        assignment.refresh_from_db()
        assert assignment.status == TaskAssignmentStatus.PENDING

    def test_daily_dashboard_only_counts_current_user_and_org(self):
        now = timezone.now()
        pending_task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner, due_at=now - timedelta(hours=1))
        TaskAssignment.objects.create(task=pending_task, assignee=self.member)
        other_task = baker.make(WorkTask, organization=self.org, creator=self.owner)
        TaskAssignment.objects.create(task=other_task, assignee=self.other_member)
        announcement = baker.make(
            TeamAnnouncement,
            organization=self.org,
            team=self.team,
            status=AnnouncementStatus.PUBLISHED,
            require_acknowledgement=True,
            published_at=now,
        )
        AnnouncementReceipt.objects.create(announcement=announcement, recipient=self.member)
        self._login(self.member)

        response = self.client.get(f"{BASE_URL}dashboard/daily/")

        assert response.status_code == 200
        data = api_data(response)
        assert data["pending_acceptance"] == 1
        assert data["overdue"] == 1
        assert data["unacknowledged_announcements"] == 1
        assert len(data["urgent_items"]) == 1

    def test_daily_dashboard_orders_equal_deadlines_by_business_priority(self):
        due_at = timezone.now() + timedelta(hours=1)
        task_ids = {}
        for priority in ("normal", "high", "urgent"):
            task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner, priority=priority, due_at=due_at)
            assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
            task_ids[priority] = assignment.pk
        self._login(self.member)

        response = self.client.get(f"{BASE_URL}dashboard/daily/")

        assert response.status_code == 200
        assert [item["id"] for item in api_data(response)["urgent_items"]] == [task_ids["urgent"], task_ids["high"], task_ids["normal"]]

    def test_daily_dashboard_uses_three_queries(self, django_assert_num_queries):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        TaskAssignment.objects.create(task=task, assignee=self.member)

        with django_assert_num_queries(3):
            result = daily_dashboard(organization=self.org, user=self.member)

        assert result["pending_acceptance"] == 1

    def test_required_team_notification_channel_cannot_be_disabled(self):
        self._login(self.member)

        response = self.client.patch(
            "/api/notifications/preferences/team.task.assigned/",
            data=json.dumps({"in_app": False}),
            content_type="application/json",
        )

        assert response.status_code == 422
        assert not NotificationPreference.objects.filter(user=self.member, category="team.task.assigned", in_app=False).exists()

    def test_notification_output_exposes_business_target(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
        notification = baker.make(
            Notification,
            recipient=self.member,
            organization=self.org,
            target=assignment,
            category="team.task.assigned",
            data={"assignment_id": assignment.pk},
        )
        self._login(self.member)

        response = self.client.get(f"/api/notifications/{notification.pk}/")

        assert response.status_code == 200
        data = api_data(response)
        assert data["category"] == "team.task.assigned"
        assert data["data"] == {"assignment_id": assignment.pk}
        assert data["target_type"] == "team_operations.taskassignment"
        assert data["target_id"] == assignment.pk

    def test_deleting_notification_does_not_delete_task_fact(self):
        task = baker.make(WorkTask, organization=self.org, team=self.team, creator=self.owner)
        assignment = TaskAssignment.objects.create(task=task, assignee=self.member)
        notification = baker.make(Notification, recipient=self.member, organization=self.org, target=assignment)
        self._login(self.member)

        response = self.client.delete(f"/api/notifications/{notification.pk}/")

        assert response.status_code == 200
        assert WorkTask.objects.filter(pk=task.pk).exists()
        assert TaskAssignment.objects.filter(pk=assignment.pk).exists()
