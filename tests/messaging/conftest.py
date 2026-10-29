from types import SimpleNamespace

import pytest
from model_bakery import baker

from apps.accounts.models import User
from apps.messaging import services
from apps.messaging.contracts import ParticipantSpec
from apps.organizations.models import Organization, OrganizationMember


@pytest.fixture
def messaging_context(db):
    alice, bob, owner, outsider, external_a, external_b = [
        baker.make(User, username=name, is_active=True) for name in ("alice", "bob", "owner", "outsider", "external_a", "external_b")
    ]
    org = baker.make(Organization, slug="messaging-a", is_active=True)
    other_org = baker.make(Organization, slug="messaging-b", is_active=True)
    for user in (alice, bob, owner):
        baker.make(OrganizationMember, organization=org, user=user, is_owner=user == owner)
        baker.make(OrganizationMember, organization=other_org, user=user)
    return SimpleNamespace(org=org, other_org=other_org, alice=alice, bob=bob, owner=owner, outsider=outsider, external_a=external_a, external_b=external_b)


@pytest.fixture
def make_conversation(messaging_context):
    ctx = messaging_context

    def create(*, actor=None, organization=None, namespace="testing.inquiry", conversation_key="inquiry:1", context_key="resource:1", participants=None):
        return services.get_or_create_conversation(
            actor=actor or ctx.alice,
            organization=organization or ctx.org,
            namespace=namespace,
            conversation_key=conversation_key,
            context_key=context_key,
            participants=participants
            or [ParticipantSpec(user_id=ctx.alice.pk, access_kind="organization_member"), ParticipantSpec(user_id=ctx.bob.pk, access_kind="organization_member")],
        )

    return create
