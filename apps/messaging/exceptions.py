from apps.base.exceptions import BadRequestException, ConflictException, NotFoundException


class ConversationNotFound(NotFoundException):
    error = "CONVERSATION_NOT_FOUND"
    message = "会话不存在或无权访问。"


class InvalidConversationScope(BadRequestException):
    error = "CONVERSATION_SCOPE_INVALID"
    message = "会话范围或关联标识无效。"


class ConversationKeyConflict(ConflictException):
    error = "CONVERSATION_KEY_CONFLICT"
    message = "会话标识已用于其他参与人或业务关联。"


class InvalidMessageContent(BadRequestException):
    error = "MESSAGE_CONTENT_INVALID"
    message = "请输入 1～2000 字符的文字消息。"


class MessageIdempotencyConflict(ConflictException):
    error = "MESSAGE_IDEMPOTENCY_CONFLICT"
    message = "该消息标识已用于不同内容，请重新发送。"


class InvalidReadPosition(BadRequestException):
    error = "READ_POSITION_INVALID"
    message = "阅读位置无效。"


class ConversationClosed(ConflictException):
    error = "CONVERSATION_CLOSED"
    message = "会话已关闭，可以查看历史消息。"


class ConversationPeerUnavailable(ConflictException):
    error = "CONVERSATION_PEER_UNAVAILABLE"
    message = "对方暂时无法接收消息。"
