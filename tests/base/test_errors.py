import json

from apps.base.errors import _error_response
from apps.base.exceptions import QuotaExceededException
from apps.house.exceptions import ResourceInUseException


def test_quota_exceeded_default_message():
    exc = QuotaExceededException()
    assert exc.message == "已达到创建上限"
    assert str(exc) == "已达到创建上限"


def test_quota_exceeded_custom_message():
    exc = QuotaExceededException("组织数量已达上限，请升级套餐。")
    assert exc.message == "组织数量已达上限，请升级套餐。"


def test_quota_exceeded_code():
    assert QuotaExceededException.code == 429
    assert QuotaExceededException.error == "QUOTA_EXCEEDED"


def test_resource_in_use_exception_carries_structured_check_data():
    check = {"can_delete": False, "resources": [{"type": "house", "count": 1}]}

    exc = ResourceInUseException("楼栋仍有关联房源，无法删除。", check)

    assert exc.error == "RESOURCE_IN_USE"
    assert exc.code == 409
    assert exc.message == "楼栋仍有关联房源，无法删除。"
    assert exc.data == check
    assert exc.fields is None


def test_error_response_prefers_structured_data_over_fields():
    check = {"can_delete": False, "resources": []}

    response = _error_response(error="RESOURCE_IN_USE", message="仍有关联资源", code=409, fields={"role": ["legacy"]}, data=check)

    assert json.loads(response.content)["data"] == check
