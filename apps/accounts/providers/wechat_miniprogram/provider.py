import requests as http_requests

from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.providers.base import Provider, ProviderAccount


JSCODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"


class WechatMiniprogramAccount(ProviderAccount):
    pass


class WechatMiniprogramProvider(Provider):
    id = "wechat_miniprogram"
    name = "微信小程序"
    account_class = WechatMiniprogramAccount
    uses_apps = True
    supports_token_authentication = True

    def extract_uid(self, data):
        return data["openid"]

    def extract_extra_data(self, data):
        return {
            "openid": data.get("openid"),
            "unionid": data.get("unionid"),
        }

    def extract_common_fields(self, data):
        return {"username": self._generate_wx_username()}

    def _generate_wx_username(self):
        import random
        import string
        import uuid
        from django.contrib.auth import get_user_model

        User = get_user_model()
        for _ in range(10):
            suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
            username = f"wx_{suffix}"
            if not User.objects.filter(username=username).exists():
                return username
        return f"wx_{uuid.uuid4().hex[:12]}"

    def verify_token(self, request, token):
        code = token.get("id_token")
        if not code:
            raise get_adapter().validation_error("invalid_token", "缺少 code 参数。")

        app = self.app
        params = {
            "appid": app.client_id,
            "secret": app.secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }
        resp = http_requests.get(JSCODE2SESSION_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("errcode"):
            from django.core.exceptions import ValidationError

            raise ValidationError(f"微信登录失败: {data.get('errmsg', data['errcode'])}")

        return self.sociallogin_from_response(request, data)


provider_classes = [WechatMiniprogramProvider]
