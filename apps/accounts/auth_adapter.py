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

    def set_phone_verified(self, user, phone):
        """Mark the phone number as verified."""
        user.phone_verified = True
        user.save(update_fields=["phone_verified"])

    def get_user_by_phone(self, phone):
        """Look up a user by phone number. Returns None if not found."""
        from apps.accounts.models import User

        try:
            return User.objects.get(phone=phone)
        except User.DoesNotExist:
            return None

    def send_verification_code_sms(self, user, phone, code, **kwargs):
        """Send SMS verification code via configured SMS backend."""
        from apps.base.sms import send_sms

        send_sms(phone, code)

    def send_unknown_account_sms(self, phone, **kwargs):
        """Silently skip SMS for unregistered numbers (enumeration prevention)."""
        pass
