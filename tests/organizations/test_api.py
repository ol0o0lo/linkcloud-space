import json
from datetime import timedelta

from django.contrib.auth import user_logged_in
from django.core import mail
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.access.models import AccessRole, OrganizationGroupBinding
from apps.accounts.models import User
from apps.organizations.models import Organization, OrganizationInvite, OrganizationMember
from apps.organizations.signals import user_logged_in_receiver
from tests.access.helpers import bind_org_role, make_access_group
from tests.api_helpers import api_data


class OrganizationAPITestBase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.user = User.objects.create_user(
            username="owner",
            email="owner@example.com",
            password="secret",  # noqa: S106
        )
        self.org = baker.make("organizations.Organization", name="Acme", billing_email="owner@example.com")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)

    def _login(self):
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()


class TestOrganizationViewSet(OrganizationAPITestBase):
    def test_create(self):
        self._login()
        resp = self.client.post(
            "/api/organizations/",
            data=json.dumps({"name": "New Co", "slug": "new-co"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        new_org = Organization.objects.get(slug="new-co")
        self.assertTrue(new_org.is_owner(self.user))

    def test_switch_list(self):
        other = baker.make("organizations.Organization", name="Other Co")
        baker.make("organizations.OrganizationMember", organization=other, user=self.user, is_owner=False)
        self._login()
        resp = self.client.get("/api/organizations/switch-list/")
        self.assertEqual(resp.status_code, 200)
        slugs = {o["slug"] for o in api_data(resp)}
        self.assertEqual(slugs, {self.org.slug, other.slug})

    def test_select(self):
        self._login()
        resp = self.client.post(f"/api/organizations/{self.org.slug}/select/")
        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertEqual(data["slug"], self.org.slug)
        self.assertTrue(data["is_owner"])

    def test_set_primary(self):
        self._login()
        resp = self.client.post(f"/api/organizations/{self.org.slug}/set-primary/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(api_data(resp)["is_primary"])
        membership = OrganizationMember.objects.get(organization=self.org, user=self.user)
        self.assertTrue(membership.is_primary)

    def test_signout(self):
        self._login()
        resp = self.client.post("/api/organizations/signout/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(api_data(resp)["success"])
        self.assertNotIn("organization_data", self.client.session)

    def test_owner_can_update_organization_profile_and_limits(self):
        self._login()
        resp = self.client.patch(
            f"/api/organizations/{self.org.slug}/",
            data=json.dumps(
                {
                    "name": "Acme Updated",
                    "billing_email": "billing@example.com",
                    "member_limit": 12,
                    "team_limit": 3,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.name, "Acme Updated")
        self.assertEqual(self.org.billing_email, "billing@example.com")
        self.assertEqual(self.org.member_limit, 12)
        self.assertEqual(self.org.team_limit, 3)

    def test_owner_can_read_organization_detail(self):
        self.org.member_limit = 12
        self.org.team_limit = 3
        self.org.is_active = False
        self.org.save(update_fields=["member_limit", "team_limit", "is_active"])
        self._login()

        resp = self.client.get(f"/api/organizations/{self.org.slug}/")

        self.assertEqual(resp.status_code, 200)
        payload = api_data(resp)
        self.assertEqual(payload["name"], self.org.name)
        self.assertEqual(payload["slug"], self.org.slug)
        self.assertEqual(payload["billing_email"], "owner@example.com")
        self.assertEqual(payload["member_limit"], 12)
        self.assertEqual(payload["team_limit"], 3)
        self.assertFalse(payload["is_active"])

    def test_owner_can_archive_and_restore_organization(self):
        self._login()
        archive_resp = self.client.patch(
            f"/api/organizations/{self.org.slug}/status/",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )
        self.assertEqual(archive_resp.status_code, 200)
        self.assertFalse(api_data(archive_resp)["is_active"])
        self.org.refresh_from_db()
        self.assertFalse(self.org.is_active)

        restore_resp = self.client.patch(
            f"/api/organizations/{self.org.slug}/status/",
            data=json.dumps({"is_active": True}),
            content_type="application/json",
        )
        self.assertEqual(restore_resp.status_code, 200)
        self.org.refresh_from_db()
        self.assertTrue(self.org.is_active)

    def test_owner_can_transfer_owner_to_existing_member(self):
        new_owner = User.objects.create_user(username="new-owner", email="new-owner@example.com", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=new_owner, is_owner=False)
        self._login()

        resp = self.client.post(
            f"/api/organizations/{self.org.slug}/transfer-owner/",
            data=json.dumps({"user": new_owner.pk}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(OrganizationMember.objects.get(organization=self.org, user=new_owner).is_owner)
        self.assertFalse(OrganizationMember.objects.get(organization=self.org, user=self.user).is_owner)

    def test_owner_can_read_organization_usage(self):
        other_member = User.objects.create_user(username="other", email="other@example.com", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=other_member, is_owner=False)
        baker.make("teams.Team", organization=self.org)
        self.org.member_limit = 5
        self.org.team_limit = 2
        self.org.save(update_fields=["member_limit", "team_limit"])
        self._login()

        resp = self.client.get(f"/api/organizations/{self.org.slug}/usage/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertEqual(data["member_count"], 2)
        self.assertEqual(data["team_count"], 1)
        self.assertEqual(data["member_limit"], 5)
        self.assertEqual(data["team_limit"], 2)


class TestOrganizationMemberViewSet(OrganizationAPITestBase):
    def test_list(self):
        self._login()
        resp = self.client.get("/api/organization-members/")
        self.assertEqual(resp.status_code, 200)
        items = api_data(resp)["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["user"]["id"], self.user.pk)

    def test_list_q_search(self):
        match = User.objects.create_user(
            username="alice",
            first_name="Alice",
            last_name="Wonder",
            email="alice@example.com",
            password="x",  # noqa: S106
        )
        baker.make("organizations.OrganizationMember", organization=self.org, user=match)
        miss = User.objects.create_user(
            username="bob",
            first_name="Bob",
            last_name="Builder",
            email="bob@example.com",
            password="x",  # noqa: S106
        )
        baker.make("organizations.OrganizationMember", organization=self.org, user=miss)
        self._login()
        resp = self.client.get("/api/organization-members/", {"q": "alice"})
        self.assertEqual(resp.status_code, 200)
        items = api_data(resp)["items"]
        usernames = {r["user"]["username"] for r in items}
        self.assertIn("alice", usernames)
        self.assertNotIn("bob", usernames)

    def test_create_member(self):
        new_user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="secret",  # noqa: S106
        )
        self._login()
        resp = self.client.post(
            "/api/organization-members/",
            data=json.dumps({"user": new_user.pk, "is_owner": False}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(OrganizationMember.objects.filter(organization=self.org, user=new_user).exists())

    def test_org_admin_can_create_member(self):
        admin = User.objects.create_user(username="admin", email="admin@example.com", password="secret")  # noqa: S106
        new_user = User.objects.create_user(
            username="member2",
            email="member2@example.com",
            password="secret",  # noqa: S106
        )
        baker.make("organizations.OrganizationMember", organization=self.org, user=admin, is_owner=False)
        group = make_access_group(
            "org_admin_for_members",
            AccessRole.Scope.ORG,
            [("organizations", "member_manage")],
        )
        bind_org_role(self.org, admin, group)
        self.user = admin
        self._login()

        resp = self.client.post(
            "/api/organization-members/",
            data=json.dumps({"user": new_user.pk, "is_owner": False}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(OrganizationMember.objects.filter(organization=self.org, user=new_user).exists())

    def test_destroy_member(self):
        new_user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="secret",  # noqa: S106
        )
        membership = baker.make("organizations.OrganizationMember", organization=self.org, user=new_user, is_owner=False)
        self._login()
        resp = self.client.delete(f"/api/organization-members/{membership.pk}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.assertFalse(OrganizationMember.objects.filter(pk=membership.pk).exists())

    def test_search(self):
        User.objects.create_user(
            username="searchable",
            email="searchable@example.com",
            first_name="Search",
            last_name="Able",
            password="secret",  # noqa: S106
        )
        self._login()
        resp = self.client.get("/api/organization-members/search/", {"q": "Searchable"})
        self.assertEqual(resp.status_code, 200)
        usernames = [u["username"] for u in api_data(resp)]
        self.assertIn("searchable", usernames)

    def test_search_without_keyword_returns_invitable_users(self):
        User.objects.create_user(
            username="candidate",
            email="candidate@example.com",
            password="secret",  # noqa: S106
        )
        self._login()
        resp = self.client.get("/api/organization-members/search/")
        self.assertEqual(resp.status_code, 200)
        usernames = [u["username"] for u in api_data(resp)]
        self.assertIn("candidate", usernames)


class TestOrganizationInviteViewSet(OrganizationAPITestBase):
    def test_list(self):
        invite = baker.make(
            "organizations.OrganizationInvite",
            organization=self.org,
            sender=self.user,
            invitee_email="guest@example.com",
        )
        self._login()
        resp = self.client.get("/api/organization-invites/")
        self.assertEqual(resp.status_code, 200)
        items = api_data(resp)["items"]
        ids = {r["pk"] for r in items}
        self.assertIn(invite.pk, ids)

    def test_create_invite(self):
        self._login()
        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/organization-invites/",
                data=json.dumps({"invitee_email": "guest@example.com", "is_owner": False}),
                content_type="application/json",
            )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(OrganizationInvite.objects.filter(organization=self.org).count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("guest@example.com", mail.outbox[0].to)

    def test_create_invite_with_access_role(self):
        group = make_access_group("invite_org_role", AccessRole.Scope.ORG, [])
        self._login()
        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/organization-invites/",
                data=json.dumps({"invitee_email": "guest@example.com", "access_role": group.access_role.pk}),
                content_type="application/json",
            )
        self.assertEqual(resp.status_code, 201)
        invite = OrganizationInvite.objects.get(organization=self.org)
        self.assertFalse(invite.is_owner)
        self.assertEqual(invite.access_role, group.access_role)

    def test_create_invite_ignores_owner_for_regular_admin(self):
        self._login()
        mail.outbox = []
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(
                "/api/organization-invites/",
                data=json.dumps({"invitee_email": "guest@example.com", "is_owner": True}),
                content_type="application/json",
            )
        self.assertEqual(resp.status_code, 201)
        invite = OrganizationInvite.objects.get(organization=self.org)
        self.assertFalse(invite.is_owner)

    def test_accept_invite_assigns_access_role_without_owner(self):
        group = make_access_group("accepted_invite_org_role", AccessRole.Scope.ORG, [])
        invitee = User.objects.create_user(username="guest", email="guest@example.com", password="secret")  # noqa: S106
        invite = OrganizationInvite.objects.create(
            organization=self.org,
            sender=self.user,
            invitee_email="guest@example.com",
            access_role=group.access_role,
        )
        self.client.force_login(invitee)
        resp = self.client.post(f"/api/invite-by-key/{invite.key}/accept/")
        self.assertEqual(resp.status_code, 200)
        member = OrganizationMember.objects.get(organization=self.org, user=invitee)
        self.assertFalse(member.is_owner)
        self.assertTrue(OrganizationGroupBinding.objects.filter(organization=self.org, user=invitee, group=group).exists())

    def test_destroy_invite(self):
        invite = baker.make(
            "organizations.OrganizationInvite",
            organization=self.org,
            sender=self.user,
            invitee_email="guest@example.com",
        )
        self._login()
        resp = self.client.delete(f"/api/organization-invites/{invite.pk}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.assertFalse(OrganizationInvite.objects.filter(pk=invite.pk).exists())

    def test_resend_invite(self):
        invite = OrganizationInvite.objects.create(
            organization=self.org,
            sender=self.user,
            invitee_email="guest@example.com",
        )
        self._login()
        mail.outbox = []

        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(f"/api/organization-invites/{invite.pk}/resend/")

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(api_data(resp)["success"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("guest@example.com", mail.outbox[0].to)

    def test_resend_expired_invite_refreshes_expiration(self):
        invite = OrganizationInvite.objects.create(
            organization=self.org,
            sender=self.user,
            invitee_email="guest@example.com",
        )
        stale_created_at = timezone.now() - timedelta(days=invite.expired_in_days + 1)
        OrganizationInvite.objects.filter(pk=invite.pk).update(created_at=stale_created_at)
        invite.refresh_from_db()
        old_key = invite.key
        self.assertTrue(invite.is_expired)

        self._login()
        mail.outbox = []

        with self.captureOnCommitCallbacks(execute=True):
            resp = self.client.post(f"/api/organization-invites/{invite.pk}/resend/")

        self.assertEqual(resp.status_code, 200)
        invite.refresh_from_db()
        self.assertFalse(invite.is_expired)
        self.assertNotEqual(invite.key, old_key)
        self.assertEqual(len(mail.outbox), 1)


class TestOrganizationSettingsViewSet(OrganizationAPITestBase):
    def test_retrieve_settings(self):
        self._login()
        resp = self.client.get("/api/organization-settings/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp)["billing_email"], "owner@example.com")

    def test_update_settings(self):
        self._login()
        resp = self.client.patch(
            "/api/organization-settings/update_settings/",
            data=json.dumps({"billing_email": "billing@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.org.refresh_from_db()
        self.assertEqual(self.org.billing_email, "billing@example.com")
