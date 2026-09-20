from typing import Any, Literal

from django.core.cache import cache
from django.utils.crypto import salted_hmac

InvitationReceiptKind = Literal["organization", "landlord"]
INVITATION_RECEIPT_TTL_SECONDS = 7 * 24 * 60 * 60


def _receipt_key(kind: InvitationReceiptKind, credential: str, user_id: int) -> str:
    digest = salted_hmac("invitation.acceptance-receipt", f"{kind}:{credential}").hexdigest()
    return f"invitation-receipt:{kind}:{user_id}:{digest}"


def save_invitation_receipt(kind: InvitationReceiptKind, credential: str, user_id: int, result: dict[str, Any]) -> None:
    cache.set(_receipt_key(kind, credential, user_id), result, timeout=INVITATION_RECEIPT_TTL_SECONDS)


def get_invitation_receipt(kind: InvitationReceiptKind, credential: str, user_id: int) -> dict[str, Any] | None:
    result = cache.get(_receipt_key(kind, credential, user_id))
    return result if isinstance(result, dict) else None
