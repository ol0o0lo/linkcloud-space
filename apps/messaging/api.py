from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated
from apps.messaging import services
from apps.messaging.constants import ParticipantAccessKind
from apps.messaging.exceptions import ConversationNotFound, InvalidConversationScope
from apps.messaging.schemas import (
    MessagingConversationOut,
    MessagingDirectIn,
    MessagingMessageIn,
    MessagingMessageOut,
    MessagingPeerOut,
    MessagingPersonalOrganizationOut,
    MessagingReadIn,
    MessagingReadOut,
    MessagingUnreadCountOut,
)
from apps.organizations.constants import ORG_SLUG_HEADER
from apps.organizations.models import Organization

router = Router(tags=["Messaging"])


class MessagingPagination(LegacyPagination):
    default_page_size = 20
    max_page_size = 100


def _scope(request, organization_slug):
    require_authenticated(request)
    org = Organization.objects.filter(slug=organization_slug, is_active=True).first()
    if org is None:
        raise ConversationNotFound()
    if ORG_SLUG_HEADER in request.headers:
        if request.headers[ORG_SLUG_HEADER] != organization_slug:
            raise ConversationNotFound()
        return org, ParticipantAccessKind.ORGANIZATION_MEMBER
    return org, ParticipantAccessKind.BUSINESS_PARTY


@router.get("/personal/organizations/", response=list[MessagingPersonalOrganizationOut], operation_id="messaging_list_personal_organizations", summary="查询本人业务会话的组织")
@paginate(MessagingPagination)
def list_personal_organizations(request, namespace: str | None = Query(None)):
    require_authenticated(request)
    if ORG_SLUG_HEADER in request.headers:
        raise InvalidConversationScope("个人业务会话请求不能携带组织请求头。")
    return services.list_personal_organizations(actor=request.user, namespace=namespace)


@router.get("/organizations/{organization_slug}/peers/", response=list[MessagingPeerOut], operation_id="messaging_list_peers", summary="查询组织单聊候选成员")
@paginate(MessagingPagination)
def list_peers(request, organization_slug: str, keyword: str = Query("")):
    org, kind = _scope(request, organization_slug)
    if kind != ParticipantAccessKind.ORGANIZATION_MEMBER:
        raise ConversationNotFound()
    return services.list_direct_peers(actor=request.user, organization=org, keyword=keyword)


@router.post(
    "/organizations/{organization_slug}/conversations/direct/",
    response=MessagingConversationOut,
    operation_id="messaging_create_direct_conversation",
    summary="创建或复用组织成员单聊",
)
def create_direct_conversation(request, organization_slug: str, payload: MessagingDirectIn):
    org, kind = _scope(request, organization_slug)
    if kind != ParticipantAccessKind.ORGANIZATION_MEMBER:
        raise ConversationNotFound()
    return services.get_or_create_direct_conversation(actor=request.user, organization=org, peer_user_id=payload.peer_user_id)


@router.get("/organizations/{organization_slug}/conversations/", response=list[MessagingConversationOut], operation_id="messaging_list_conversations", summary="查询本人会话")
@paginate(MessagingPagination)
def list_conversations(request, organization_slug: str, namespace: str | None = Query(None)):
    org, kind = _scope(request, organization_slug)
    return services.list_conversations(actor=request.user, organization=org, access_kind=kind, namespace=namespace)


@router.get(
    "/organizations/{organization_slug}/conversations/{conversation_id}/", response=MessagingConversationOut, operation_id="messaging_get_conversation", summary="查询本人会话详情"
)
def get_conversation(request, organization_slug: str, conversation_id: int):
    org, kind = _scope(request, organization_slug)
    return services.get_conversation(actor=request.user, organization=org, access_kind=kind, conversation_id=conversation_id)


@router.get(
    "/organizations/{organization_slug}/conversations/{conversation_id}/messages/",
    response=list[MessagingMessageOut],
    operation_id="messaging_list_messages",
    summary="查询聊天历史或增量消息",
)
@paginate(MessagingPagination)
def list_messages(request, organization_slug: str, conversation_id: int, before_seq: int | None = Query(None), after_seq: int | None = Query(None)):
    org, kind = _scope(request, organization_slug)
    return services.list_messages(actor=request.user, organization=org, access_kind=kind, conversation_id=conversation_id, before_seq=before_seq, after_seq=after_seq)


@router.post(
    "/organizations/{organization_slug}/conversations/{conversation_id}/messages/",
    response={200: MessagingMessageOut, 201: MessagingMessageOut},
    operation_id="messaging_send_message",
    summary="发送文字消息",
)
def send_message(request, organization_slug: str, conversation_id: int, payload: MessagingMessageIn):
    org, kind = _scope(request, organization_slug)
    message, created = services.send_message(
        actor=request.user, organization=org, access_kind=kind, conversation_id=conversation_id, client_message_id=payload.client_message_id, content=payload.content
    )
    return Status(201 if created else 200, message)


@router.patch(
    "/organizations/{organization_slug}/conversations/{conversation_id}/read/", response=MessagingReadOut, operation_id="messaging_mark_read", summary="推进本人会话阅读位置"
)
def mark_read(request, organization_slug: str, conversation_id: int, payload: MessagingReadIn):
    org, kind = _scope(request, organization_slug)
    return services.mark_read(actor=request.user, organization=org, access_kind=kind, conversation_id=conversation_id, last_read_seq=payload.last_read_seq)


@router.get("/organizations/{organization_slug}/unread-count/", response=MessagingUnreadCountOut, operation_id="messaging_get_unread_count", summary="查询当前组织聊天未读")
def unread_count(request, organization_slug: str, namespace: str | None = Query(None)):
    org, kind = _scope(request, organization_slug)
    return services.get_unread_counts(actor=request.user, organization=org, access_kind=kind, namespace=namespace)
