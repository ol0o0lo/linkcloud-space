import base64
import hashlib
import hmac
import json

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


def _callback_secret(provider: str) -> str:
    return getattr(settings, "WALLET_PAYOUT_CALLBACK_SECRETS", {}).get(provider, "")


def build_callback_signature(*, provider: str, payload: dict) -> str:
    secret = _callback_secret(provider)
    if not secret:
        raise ValueError(f"Missing callback secret for provider: {provider}")
    message = json.dumps(
        {"provider": provider, **payload},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_callback_signature(*, provider: str, payload: dict, signature: str) -> bool:
    if not signature:
        return False
    try:
        expected = build_callback_signature(provider=provider, payload=payload)
    except ValueError:
        return False
    return hmac.compare_digest(expected, signature)
