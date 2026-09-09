from django.core.exceptions import ValidationError

from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.providers.base import Provider, ProviderAccount

from apps.accounts.providers.wechat_miniprogram.client import jscode2session
from apps.accounts.wechat_identity import generate_wechat_username


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
        return {"username": generate_wechat_username()}

    def verify_token(self, request, token):
        # 用微信接口把前端传来的 code 换成登录载荷。
        code = token.get("id_token")
        if not code:
            raise get_adapter().validation_error("invalid_token", "缺少 code 参数。")

        try:
            data = jscode2session(self.app, code)
        except ValueError as e:
            raise ValidationError(str(e)) from e

        return self.sociallogin_from_response(request, data)


provider_classes = [WechatMiniprogramProvider]
