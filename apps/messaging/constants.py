from apps.base.enums import StrChoices


class ConversationStatus(StrChoices):
    ACTIVE = "active", "进行中"
    CLOSED = "closed", "已关闭"


class ParticipantAccessKind(StrChoices):
    ORGANIZATION_MEMBER = "organization_member", "组织成员"
    BUSINESS_PARTY = "business_party", "业务参与人"


class SendBlockReason(StrChoices):
    AVAILABLE = "", ""
    CLOSED = "closed", "会话已关闭"
    PEER_UNAVAILABLE = "peer_unavailable", "对方暂时无法接收消息"


DIRECT_NAMESPACE = "im.direct"
MAX_CONTENT_LENGTH = 2000
