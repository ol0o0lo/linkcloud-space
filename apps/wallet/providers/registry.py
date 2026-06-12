from apps.wallet.providers.wechat import WeChatPayoutProvider


def get_payout_provider(provider_code: str):
    if provider_code == "wechat":
        return WeChatPayoutProvider()
    raise ValueError(f"Unsupported payout provider: {provider_code}")
