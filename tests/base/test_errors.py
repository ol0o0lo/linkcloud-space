import pytest

from apps.base.exceptions import QuotaExceededException


def test_quota_exceeded_default_message():
    exc = QuotaExceededException()
    assert exc.message == "已达到创建上限"
    assert str(exc) == "已达到创建上限"


def test_quota_exceeded_custom_message():
    exc = QuotaExceededException("组织数量已达上限，请升级套餐。")
    assert exc.message == "组织数量已达上限，请升级套餐。"


def test_quota_exceeded_code():
    assert QuotaExceededException.full_code() == "06"
