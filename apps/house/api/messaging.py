from uuid import UUID

from django.shortcuts import get_object_or_404

from ninja import Router, Schema, Status
from pydantic import Field

from apps.base.permissions import require_authenticated
from apps.house.services.messaging import share_house_message
from apps.messaging.constants import ParticipantAccessKind
from apps.messaging.exceptions import ConversationNotFound
from apps.messaging.schemas import MessagingMessageOut
from apps.organizations.constants import ORG_SLUG_HEADER
from apps.organizations.models import Organization

router = Router(tags=["房源/聊天"])


class HouseMessageIn(Schema):
    house_id: int = Field(gt=0)
    client_message_id: UUID


@router.post(
    "/messaging/organizations/{organization_slug}/conversations/{conversation_id}/house/", response={200: MessagingMessageOut, 201: MessagingMessageOut}, summary="分享公开房源卡片"
)
def share_house(request, organization_slug: str, conversation_id: int, payload: HouseMessageIn):
    require_authenticated(request)
    organization = get_object_or_404(Organization, slug=organization_slug, is_active=True)
    kind = ParticipantAccessKind.BUSINESS_PARTY
    if ORG_SLUG_HEADER in request.headers:
        if request.headers[ORG_SLUG_HEADER] != organization_slug:
            raise ConversationNotFound()
        kind = ParticipantAccessKind.ORGANIZATION_MEMBER
    message, created = share_house_message(
        actor=request.user,
        organization=organization,
        access_kind=kind,
        conversation_id=conversation_id,
        house_id=payload.house_id,
        client_message_id=payload.client_message_id,
    )
    return Status(201 if created else 200, message)
