"""
注册 + 手机验证码流程测试。

验证：
1. 注册成功 → 返回 401 + verify_phone pending
2. 验证码已通过 ConsoleSMSBackend 发出（print 到 stdout）
3. 提交验证码 → 登录完成
"""

from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _settings(settings):
    settings.AUTHENTICATION_BACKENDS = ["allauth.account.auth_backends.AuthenticationBackend"]
    settings.ACCOUNT_SIGNUP_OPEN = True
    settings.ACCOUNT_LOGIN_METHODS = {"phone", "email"}
    settings.ACCOUNT_PHONE_VERIFICATION_ENABLED = True
    settings.ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True
    settings.ACCOUNT_SIGNUP_FIELDS = ["phone", "email*", "password1*"]


@pytest.mark.django_db
def test_signup_triggers_phone_verification(client):
    """注册后进入 verify_phone stage，验证码通过 SMS backend 发出。"""
    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms") as mock_send:
        resp = client.post(
            "/api/allauth/browser/v1/auth/signup",
            data={"email": "newuser@example.com", "password": "testpw123!", "phone": "+8613800138000"},
            content_type="application/json",
        )

    assert resp.status_code == 401, resp.content
    data = resp.json()

    # verify_phone stage 是 pending
    flows = {f["id"]: f for f in data["data"]["flows"]}
    assert "verify_phone" in flows
    assert flows["verify_phone"]["is_pending"] is True

    # send_verification_code_sms 被调用了一次，手机号正确
    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["phone"] == "+8613800138000"
    code = mock_send.call_args.kwargs["code"]
    assert code  # 验证码非空
    print(f"\n[TEST] 验证码: {code}\n")


@pytest.mark.django_db
def test_split_signup_wrapper_triggers_phone_verification(client):
    """拆分手机号注册接口应在内部转成完整手机号并触发验证流程。"""
    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms") as mock_send:
        resp = client.post(
            "/api/users/auth/browser/signup/",
            data={
                "email": "split-signup@example.com",
                "password": "testpw123!",
                "phone_country_code": "+86",
                "phone_national_number": "13800138009",
            },
            content_type="application/json",
        )

    assert resp.status_code == 401, resp.content
    flows = {f["id"]: f for f in resp.json()["data"]["flows"]}
    assert "verify_phone" in flows
    assert flows["verify_phone"]["is_pending"] is True
    mock_send.assert_called_once()
    assert mock_send.call_args.kwargs["phone"] == "+8613800138009"


@pytest.mark.django_db
def test_signup_then_verify_phone_completes_login(client):
    """注册后提交正确验证码，登录完成。"""
    captured_code = {}

    def capture_sms(user, phone, code, **kwargs):
        captured_code["code"] = code

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms", side_effect=capture_sms):
        resp = client.post(
            "/api/allauth/browser/v1/auth/signup",
            data={"email": "newuser2@example.com", "password": "testpw123!", "phone": "+8613800138001"},
            content_type="application/json",
        )

    assert resp.status_code == 401, resp.content
    assert "code" in captured_code, "验证码未被发送"

    # 提交验证码
    resp = client.post(
        "/api/allauth/browser/v1/auth/phone/verify",
        data={"code": captured_code["code"]},
        content_type="application/json",
    )
    assert resp.status_code == 200, resp.content
    assert resp.json()["meta"]["is_authenticated"] is True


@pytest.mark.django_db
def test_signup_wrong_code_returns_error(client):
    """提交错误验证码返回 400。"""
    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms"):
        client.post(
            "/api/allauth/browser/v1/auth/signup",
            data={"email": "newuser3@example.com", "password": "testpw123!", "phone": "+8613800138002"},
            content_type="application/json",
        )

    resp = client.post(
        "/api/allauth/browser/v1/auth/phone/verify",
        data={"code": "000000"},
        content_type="application/json",
    )
    assert resp.status_code == 400, resp.content
