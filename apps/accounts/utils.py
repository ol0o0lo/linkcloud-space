"""accounts app 内部工具函数。"""

import base64
import hashlib
import re

from django.conf import settings

from cryptography.fernet import Fernet, InvalidToken

CN_ID_RE = re.compile(r"^\d{17}[\dXx]$")
# 身份证号前 17 位的校验权重。
CN_ID_WEIGHTS = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
# 身份证号校验位映射表。
CN_ID_CHECKSUM = ("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2")


def encrypt_identity_value(value: str) -> str:
    # 用项目密钥派生出的 Fernet 密钥加密敏感值。
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_identity_value(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt identity value.") from exc


def mask_real_name(value: str) -> str:
    # 真实姓名按长度保留首尾字符，中间用星号遮挡。
    value = value.strip()
    if len(value) <= 1:
        return value
    if len(value) == 2:
        return f"{value[0]}*"
    return f"{value[0]}{'*' * (len(value) - 2)}{value[-1]}"


def mask_id_number(value: str) -> str:
    # 身份证号只保留前 3 位和后 4 位。
    value = normalize_id_number(value)
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:3]}{'*' * (len(value) - 7)}{value[-4:]}"


def normalize_id_number(value: str) -> str:
    # 去掉空白并统一大写，避免 X/x 造成的差异。
    return value.strip().upper()


def hash_id_number(value: str) -> str:
    # 对规范化后的身份证号做不可逆摘要，供去重判断使用。
    return hashlib.sha256(normalize_id_number(value).encode("utf-8")).hexdigest()


def is_valid_cn_id_number(value: str) -> bool:
    # 校验中国大陆身份证号格式和最后一位校验码。
    value = normalize_id_number(value)
    if not CN_ID_RE.match(value):
        return False
    total = sum(int(char) * weight for char, weight in zip(value[:17], CN_ID_WEIGHTS, strict=False))
    checksum = CN_ID_CHECKSUM[total % 11]
    return value[-1] == checksum


def _fernet() -> Fernet:
    # 从 SECRET_KEY 派生稳定密钥，避免额外保存加密配置。
    key_material = hashlib.sha256(f"{settings.SECRET_KEY}:real-name:v1".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))
