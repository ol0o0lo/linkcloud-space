"""
小程序手机号授权绑定测试。

测试策略：
- access_token 首次获取后缓存，第二次不重复请求微信 API
- 换取手机号：mock 微信 API，验证标准化格式 +86XXXXXXXXXX
- 未登录拒绝：401
- 绑定新手机号：无已有账号，写入当前 User
- 幂等：重复绑定同一手机号 → 200
- 账号合并：已有 User B 有此手机号，迁移 SocialAccount，软删除当前 User，session 切换
- 微信 API errcode → 400
"""

from unittest.mock import MagicMock, patch

from django.test import override_settings

WECHAT_PHONE_SETTINGS = {
    "CACHES": {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    },
    "SOCIALACCOUNT_PROVIDERS": {
        "wechat_miniprogram": {
            "APP": {
                "client_id": "test-miniprogram-appid",
                "secret": "test-miniprogram-secret",
            },
        },
    },
    "ACCOUNT_PHONE_VERIFICATION_ENABLED": False,
    "ALLOWED_HOSTS": ["localhost"],
}


def _make_access_token_mock(token="fake_access_token"):  # noqa: S107
    mock = MagicMock()
    mock.json.return_value = {"access_token": token, "expires_in": 7200}
    mock.raise_for_status = MagicMock()
    return mock


def _make_phone_mock(phone_number="13800138000", country_code="86"):
    mock = MagicMock()
    mock.json.return_value = {
        "errcode": 0,
        "phone_info": {
            "phoneNumber": phone_number,
            "purePhoneNumber": phone_number,
            "countryCode": country_code,
        },
    }
    mock.raise_for_status = MagicMock()
    return mock


@override_settings(**WECHAT_PHONE_SETTINGS)
def test_access_token_cached_on_second_call(db):
    """access_token 首次调用请求微信 API，第二次从 cache 读取。"""
    from django.core.cache import cache

    from allauth.socialaccount.models import SocialApp

    from apps.accounts.wechat_phone import get_miniprogram_access_token

    cache.clear()
    app = SocialApp(provider="wechat_miniprogram", client_id="test-miniprogram-appid", secret="test-miniprogram-secret")

    with patch("apps.accounts.wechat_phone.requests.post", return_value=_make_access_token_mock()) as mock_post:
        token1 = get_miniprogram_access_token(app)
        token2 = get_miniprogram_access_token(app)

    assert token1 == "fake_access_token"
    assert token2 == "fake_access_token"
    mock_post.assert_called_once()  # 只调用了一次微信 API
    cache.clear()
