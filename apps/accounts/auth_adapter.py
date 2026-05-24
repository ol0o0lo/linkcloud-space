from django.conf import settings
from django.contrib import messages
from django.http import HttpResponseRedirect

from allauth.account import signals
from allauth.account.adapter import DefaultAccountAdapter


class AccountAdapter(DefaultAccountAdapter):
    def is_open_for_signup(self, request):
        return getattr(settings, "ACCOUNT_SIGNUP_OPEN", True)

    def post_login(self, request, user, *, email_verification, signal_kwargs, email, signup, redirect_url):
        from allauth.account.utils import get_login_redirect_url

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
        """Return (phone, verified) tuple or None if no phone set."""
        if not user.phone:
            return None
        return (user.phone, user.phone_verified)

    def set_phone(self, user, phone, verified):
        """Store phone number and verification status on the user."""
        user.phone = phone
        user.phone_verified = verified
        user.save(update_fields=["phone", "phone_verified"])

    def get_user_by_phone(self, phone):
        """Look up a user by phone number.

        For the phone-code login flow (code/request), if signup is open and the
        phone is not yet registered, create an inactive placeholder so allauth can
        generate and send a verification code.  The account is activated only after
        the code is confirmed (see set_phone_verified).

        For the email+phone signup flow we deliberately do NOT create a placeholder
        here, because allauth's BaseSignupForm._clean_phone would otherwise treat the
        returned user as "account_already_exists" and silently abort the signup.
        """
        from allauth.core import context

        from apps.accounts.models import User

        try:
            return User.objects.get(phone=phone)
        except User.DoesNotExist:
            pass

        # Only auto-create a placeholder during the "login by code" request path.
        request = context.request
        is_code_request = request is not None and "code/request" in request.path
        if not is_code_request:
            return None

        if not getattr(settings, "ACCOUNT_SIGNUP_OPEN", False):
            return None

        import uuid

        user = User(
            phone=phone,
            phone_verified=False,
            is_active=False,
            username=f"phone_{uuid.uuid4().hex[:12]}",
        )
        user.set_unusable_password()
        user.save()
        return user

    def set_phone_verified(self, user, phone):
        """Mark the phone number as verified and activate new accounts."""
        user.phone_verified = True
        update_fields = ["phone_verified"]
        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")
        user.save(update_fields=update_fields)

    def send_verification_code_sms(self, user, phone, code, **kwargs):
        """Send SMS verification code via configured SMS backend."""
        from apps.base.sms import send_sms

        send_sms(phone, code)

    def send_unknown_account_sms(self, phone, **kwargs):
        """Silently skip SMS for unregistered numbers (enumeration prevention)."""
        pass

    def pre_social_login(self, request, sociallogin):
        from allauth.socialaccount.models import SocialAccount

        # 已关联 User 的登录无需合并
        if sociallogin.is_existing:
            return

        # 提取 unionid
        unionid = sociallogin.account.extra_data.get("unionid")
        if not unionid:
            return

        # weixin provider 的 uid 就是 unionid
        existing = SocialAccount.objects.filter(provider="weixin", uid=unionid).first()

        if not existing:
            # wechat_miniprogram 的 unionid 存在 extra_data 里
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
