from allauth.socialaccount.providers.base import Provider, ProviderAccount

from apps.accounts.wechat_identity import generate_wechat_username


class WechatOfficialAccount(ProviderAccount):
    def get_avatar_url(self):
        return self.account.extra_data.get("headimgurl")

    def to_str(self):
        return self.account.extra_data.get("nickname", super().to_str())


class WechatOfficialAccountProvider(Provider):
    id = "wechat_official_account"
    name = "微信公众号"
    account_class = WechatOfficialAccount
    uses_apps = False

    def extract_uid(self, data):
        return data["openid"]

    def extract_extra_data(self, data):
        return {
            "openid": data.get("openid"),
            "unionid": data.get("unionid"),
            "nickname": data.get("nickname"),
            "headimgurl": data.get("headimgurl"),
            "subscribe": data.get("subscribe"),
        }

    def extract_common_fields(self, data):
        nickname = str(data.get("nickname") or "").strip()
        return {
            "username": generate_wechat_username(),
            "first_name": nickname[:150],
        }


provider_classes = [WechatOfficialAccountProvider]
