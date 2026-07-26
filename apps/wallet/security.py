def mask_account(value: str) -> str:
    value = value.strip()
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def build_wechat_payee_snapshot(*, social_account, receiver_name: str) -> dict:
    extra_data = social_account.extra_data or {}
    raw_account = extra_data.get("openid") or social_account.uid or ""
    return {
        "channel": "wechat",
        "social_provider": social_account.provider,
        "social_uid": social_account.uid,
        "unionid": extra_data.get("unionid", ""),
        "openid": extra_data.get("openid", ""),
        "receiver_name": receiver_name,
        "masked_account": mask_account(raw_account),
    }
