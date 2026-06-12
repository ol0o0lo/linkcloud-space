import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet() -> Fernet:
    key_material = hashlib.sha256(f"{settings.SECRET_KEY}:wallet:v1".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_wallet_payload(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def mask_account(value: str) -> str:
    value = value.strip()
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def build_payee_snapshot(payee_account: dict) -> dict:
    name = payee_account["name"].strip()
    account = payee_account["account"].strip()
    return {
        "masked_name": f"{name[0]}**" if len(name) > 1 else name,
        "masked_account": mask_account(account),
        "encrypted_name": encrypt_wallet_payload(name),
        "encrypted_account": encrypt_wallet_payload(account),
    }


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
