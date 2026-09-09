import secrets
import string
import uuid

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q

from allauth.socialaccount.models import SocialAccount

WECHAT_SOCIAL_PROVIDERS = (
    "weixin",
    "wechat_miniprogram",
    "wechat_official_account",
)


def generate_wechat_username() -> str:
    """生成不冲突且不依赖微信昵称的默认用户名。"""
    User = get_user_model()
    alphabet = string.ascii_lowercase + string.digits
    for _ in range(10):
        suffix = "".join(secrets.choice(alphabet) for _ in range(8))
        username = f"wx_{suffix}"
        if not User.objects.filter(username=username).exists():
            return username
    return f"wx_{uuid.uuid4().hex[:12]}"


def connect_wechat_sociallogin_by_unionid(request, sociallogin) -> None:
    """将具有相同 UnionID 的微信身份连接到同一个用户。"""
    if sociallogin.is_existing:
        return

    unionid = (sociallogin.account.extra_data or {}).get("unionid")
    if not unionid:
        return

    candidates = list(
        SocialAccount.objects.filter(provider__in=WECHAT_SOCIAL_PROVIDERS)
        .filter(Q(extra_data__unionid=unionid) | Q(provider="weixin", uid=unionid))
        .exclude(provider=sociallogin.account.provider, uid=sociallogin.account.uid)
        .select_related("user")
        .order_by("pk")
    )
    if not candidates:
        return

    user_ids = {account.user_id for account in candidates if account.user_id}
    if len(user_ids) > 1:
        raise ValidationError("该微信 UnionID 已绑定多个账号，无法自动合并。")

    existing = candidates[0]
    if existing.user_id:
        sociallogin.connect(request, existing.user)
