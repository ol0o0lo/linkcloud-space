import re
from unittest.mock import patch

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(autouse=True)
def _signup_settings(settings):
    settings.ACCOUNT_SIGNUP_OPEN = True
    settings.ACCOUNT_LOGIN_METHODS = {"phone", "email"}
    settings.ACCOUNT_PHONE_VERIFICATION_ENABLED = True
    settings.ACCOUNT_PHONE_VERIFICATION_SUPPORTS_RESEND = True
    settings.ACCOUNT_SIGNUP_FIELDS = ["phone", "email*", "password1*"]


@pytest.mark.django_db(transaction=True)
def test_frontend_admin_public_signup_with_invite_code(page: Page, live_server):
    captured_code = {}

    def capture_sms(user, phone, code, **kwargs):
        captured_code[phone] = code

    with patch("apps.accounts.auth_adapter.AccountAdapter.send_verification_code_sms", side_effect=capture_sms):
        page.goto(f"{live_server.url}/dashboard/auth/register?invite_code=AQPSQ6OVNA&redirect=%2Fpromotion")

        expect(page.get_by_text("AQPSQ6OVNA")).to_be_visible()
        page.get_by_placeholder("请输入邮箱").fill("frontend-admin-signup@example.com")
        page.get_by_placeholder("请输入手机号").fill("+8613800138011")
        page.get_by_placeholder(re.compile("密码")).first.fill("testpw123!")
        page.get_by_placeholder(re.compile("确认密码")).fill("testpw123!")
        page.get_by_role("checkbox").check()
        page.get_by_role("button", name="创建账号").click()

        page.wait_for_url(re.compile(r"/dashboard/auth/verify-phone"), timeout=10000)
        expect(page.get_by_text("+8613800138011")).to_be_visible()

        assert "+8613800138011" in captured_code, "验证码未被发送"

        verify_input = page.locator("input").first
        verify_input.click()
        verify_input.fill(captured_code["+8613800138011"])
        page.get_by_role("button", name="确认验证").click()

        page.wait_for_url(re.compile(r"/dashboard/promotion"), timeout=10000)
        expect(page.get_by_text("我的推广链接")).to_be_visible(timeout=10000)

