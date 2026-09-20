from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from urllib.parse import urlencode

from django.conf import settings

from apps.accounts.providers.wechat_miniprogram.client import create_url_link

InvitationKind = Literal["organization", "landlord"]
INVITATION_PAGE_PATH = "pages/invitations/index"


@dataclass(frozen=True)
class MiniProgramAppCredentials:
    client_id: str
    secret: str


def _configured_miniprogram_app() -> MiniProgramAppCredentials:
    provider = settings.SOCIALACCOUNT_PROVIDERS.get("wechat_miniprogram", {})
    app = provider.get("APP", {})
    return MiniProgramAppCredentials(
        client_id=str(app.get("client_id") or ""),
        secret=str(app.get("secret") or ""),
    )


def build_invitation_action_url(
    *,
    kind: InvitationKind,
    credential: str,
    expires_at: datetime,
    legacy_url: str,
) -> str:
    if not settings.WECHAT_MINIPROGRAM_URL_LINK_ENABLED:
        return legacy_url
    query_key = {"organization": "key", "landlord": "token"}.get(kind)
    if query_key is None:
        raise ValueError("不支持的小程序邀请类型。")
    normalized_credential = credential.strip()
    if not normalized_credential:
        raise ValueError("小程序邀请凭证不能为空。")
    return create_url_link(
        _configured_miniprogram_app(),
        path=INVITATION_PAGE_PATH,
        query=urlencode({"kind": kind, query_key: normalized_credential}),
        expire_time=int(expires_at.timestamp()),
        env_version=settings.WECHAT_MINIPROGRAM_URL_LINK_ENV_VERSION,
    )
