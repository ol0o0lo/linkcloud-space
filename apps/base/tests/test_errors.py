import pytest

from apps.base.errors import QuotaExceededError


def test_quota_exceeded_error_default_message():
    exc = QuotaExceededError()
    assert exc.message == "已达到创建上限。"
    assert str(exc) == "已达到创建上限。"


def test_quota_exceeded_error_custom_message():
    exc = QuotaExceededError("组织数量已达上限，请升级套餐。")
    assert exc.message == "组织数量已达上限，请升级套餐。"
