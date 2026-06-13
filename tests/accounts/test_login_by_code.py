"""
测试 allauth login-by-code（手机验证码登录）流程。

流程：
1. POST /api/allauth/app/v1/auth/code/request  → 触发 SMS，返回 session_token
2. POST /api/allauth/app/v1/auth/code/confirm  → 提交验证码，完成登录
"""

from unittest.mock import patch

import pytest

from apps.accounts.models import User


def _phone_qs(phone):
    from apps.accounts.models import split_phone

    country_code, national_number = split_phone(phone)
    return User.objects.filter(phone_country_code=country_code, phone_national_number=national_number)


@pytest.fixture()
def phone_user(db):
    user = User.objects.create(
        email="phone_user@example.com",
        username="phone_user@example.com",
        phone="+8613800138000",
        phone_verified=True,
    )
    user.set_password("pw")
    user.save()
    return user


@pytest.fixture(autouse=True)
def _login_by_code_settings(settings):
    settings.ACCOUNT_LOGIN_METHODS = {"phone"}
    settings.ACCOUNT_LOGIN_BY_CODE_ENABLED = True
    settings.ACCOUNT_PHONE_VERIFICATION_ENABLED = True
    settings.ACCOUNT_SIGNUP_OPEN = False


@pytest.mark.django_db
def test_code_request_triggers_sms(client, phone_user):
    """code/request 应调用 send_verification_code_sms 发送验证码。"""
    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms") as mock_sms:
        resp = client.post(
            "/api/allauth/app/v1/auth/code/request",
            data={"phone": phone_user.phone},
            content_type="application/json",
        )
    assert resp.status_code in (200, 401), resp.content
    assert mock_sms.called, "allauth 没有调用 send_verification_code_sms！"


@pytest.mark.django_db
def test_code_request_returns_session_token(client, phone_user):
    """code/request 成功后，响应里应包含 session_token。"""
    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms"):
        resp = client.post(
            "/api/allauth/app/v1/auth/code/request",
            data={"phone": phone_user.phone},
            content_type="application/json",
        )
    assert resp.status_code in (200, 401), resp.content
    data = resp.json()
    assert "meta" in data
    assert "session_token" in data["meta"], f"响应中无 session_token，实际: {data}"


@pytest.mark.django_db
def test_code_confirm_completes_login(client, phone_user):
    """用正确的验证码确认后，应成功登录并返回 JWT token。"""
    captured = {}

    def capture_sms(user, phone, code, **kwargs):
        captured["code"] = code

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms", side_effect=capture_sms):
        resp = client.post(
            "/api/allauth/app/v1/auth/code/request",
            data={"phone": phone_user.phone},
            content_type="application/json",
        )
    assert resp.status_code in (200, 401), resp.content
    session_token = resp.json()["meta"]["session_token"]
    assert "code" in captured, "SMS 没有被调用，无法获取验证码"

    confirm_resp = client.post(
        "/api/allauth/app/v1/auth/code/confirm",
        data={"code": captured["code"]},
        content_type="application/json",
        headers={"X-Session-Token": session_token},
    )
    assert confirm_resp.status_code == 200, confirm_resp.content
    data = confirm_resp.json()
    assert "data" in data
    assert "user" in data["data"], f"登录成功但无 user 数据: {data}"


@pytest.mark.django_db
def test_code_request_auto_registers_unknown_phone(client, settings):
    """ACCOUNT_SIGNUP_OPEN=True 时，未注册手机号应创建 inactive 占位用户并发送验证码。"""
    settings.ACCOUNT_SIGNUP_OPEN = True

    phone = "+8619900000099"
    assert not _phone_qs(phone).exists()

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms") as mock_sms:
        resp = client.post(
            "/api/allauth/app/v1/auth/code/request",
            data={"phone": phone},
            content_type="application/json",
        )

    assert resp.status_code in (200, 401), resp.content
    assert mock_sms.called, "应发送验证码"
    user = _phone_qs(phone).first()
    assert user is not None, "占位用户应被创建"
    assert not user.is_active, "验证前用户应为 inactive"
    assert not user.phone_verified


@pytest.mark.django_db
def test_code_confirm_activates_new_user(client, settings):
    """未注册手机号走完完整流程后，用户应被激活且 phone_verified=True。"""
    settings.ACCOUNT_SIGNUP_OPEN = True

    phone = "+8619900000097"
    captured = {}

    def capture_sms(user, phone, code, **kwargs):
        captured["code"] = code

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms", side_effect=capture_sms):
        resp = client.post(
            "/api/allauth/app/v1/auth/code/request",
            data={"phone": phone},
            content_type="application/json",
        )
    session_token = resp.json()["meta"]["session_token"]

    confirm_resp = client.post(
        "/api/allauth/app/v1/auth/code/confirm",
        data={"code": captured["code"]},
        content_type="application/json",
        headers={"X-Session-Token": session_token},
    )
    assert confirm_resp.status_code == 200, confirm_resp.content

    user = _phone_qs(phone).get()
    assert user.is_active, "验证通过后用户应被激活"
    assert user.phone_verified, "验证通过后 phone_verified 应为 True"


@pytest.mark.django_db
def test_code_request_no_auto_register_when_signup_closed(client, settings):
    """ACCOUNT_SIGNUP_OPEN=False 时，未注册手机号不应创建用户。"""
    settings.ACCOUNT_SIGNUP_OPEN = False
    phone = "+8619900000098"

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_unknown_account_sms"):
        resp = client.post(
            "/api/allauth/app/v1/auth/code/request",
            data={"phone": phone},
            content_type="application/json",
        )

    assert resp.status_code in (200, 401), resp.content
    assert not _phone_qs(phone).exists(), "注册关闭时不应创建用户"
