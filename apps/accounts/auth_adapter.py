import uuid

from django.conf import settings
from django.contrib import messages
from django.http import HttpResponseRedirect

from allauth.account import signals
from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import get_login_redirect_url
from allauth.core import context
from allauth.socialaccount.models import SocialAccount

from apps.accounts.models import User, normalize_phone, split_phone
from apps.base.sms import send_sms


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return getattr(settings, "ACCOUNT_SIGNUP_OPEN", True)

    def post_login(self, request, user, *, email_verification, signal_kwargs, email, signup, redirect_url):
        """登录成功后统一走项目自己的跳转和消息提示。"""
        response = HttpResponseRedirect(get_login_redirect_url(request, redirect_url, signup=signup))

        if signal_kwargs is None:
            signal_kwargs = {}
        signals.user_logged_in.send(
            sender=user.__class__,
            request=request,
            response=response,
            user=user,
            **signal_kwargs,
        )

        if getattr(settings, "ACCOUNT_SHOW_POST_LOGIN_MESSAGE", True) is True:
            self.add_message(
                request,
                messages.SUCCESS,
                "account/messages/logged_in.txt",
                {"user": user},
            )

        return response

    # --- Phone number support (django-allauth) ---

    def get_phone(self, user):
        """返回手机号和验证状态；未设置时返回 None。"""
        if not user.phone:
            return None
        return (user.phone, user.phone_verified)

    def set_phone(self, user, phone, verified):
        """写回手机号和验证状态到 User。"""
        user.set_phone_number(phone, verified)
        user.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])

    def get_user_by_phone(self, phone):
        """
        按手机号查找用户。

        仅在验证码登录路径下、且手机号尚未注册时，才创建一个临时占位账号，
        让 allauth 能继续发验证码。
        """
        country_code, national_number = split_phone(phone)
        if not national_number:
            return None
        try:
            return User.objects.get(phone_country_code=country_code, phone_national_number=national_number)
        except User.DoesNotExist:
            pass

        request = context.request
        is_code_request = request is not None and "code/request" in request.path
        if not is_code_request:
            return None

        if not getattr(settings, "ACCOUNT_SIGNUP_OPEN", False):
            return None

        user = User(
            phone_verified=False,
            is_active=False,
            username=f"phone_{uuid.uuid4().hex[:12]}",
        )
        user.set_phone_number(phone, False)
        user.set_unusable_password()
        user.save()
        return user

    def set_phone_verified(self, user, phone):
        """手机号验证通过后同步激活账号。"""
        if user.phone != normalize_phone(phone):
            user.set_phone_number(phone)
        user.phone_verified = True
        update_fields = ["phone_country_code", "phone_national_number", "phone_verified"]
        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")
        user.save(update_fields=update_fields)

    def send_verification_code_sms(self, user, phone, code, **kwargs):
        """通过项目内短信封装发送验证码。"""
        send_sms(phone, code)

    def send_unknown_account_sms(self, phone, **kwargs):
        """对未注册手机号静默跳过发送，避免枚举账号。"""
        pass

    def pre_social_login(self, request, sociallogin):
        """按 unionid 合并微信和小程序账号。"""
        if sociallogin.is_existing:
            return

        unionid = sociallogin.account.extra_data.get("unionid")
        if not unionid:
            return

        existing = SocialAccount.objects.filter(provider="weixin", uid=unionid).first()

        if not existing:
            existing = (
                SocialAccount.objects.filter(
                    provider="wechat_miniprogram",
                    extra_data__unionid=unionid,
                )
                .exclude(uid=sociallogin.account.uid)
                .first()
            )

        if existing and existing.user_id:
            sociallogin.connect(request, existing.user)
