from django.conf import settings
from django.utils.module_loading import import_string


def _get_backend():
    backend_class = import_string(settings.SMS_BACKEND)
    return backend_class()


def send_sms(phone: str, code: str) -> None:
    """Send an SMS using the configured SMS_BACKEND."""
    _get_backend().send(phone, code)


def send_invitation_sms(phone: str, action_url: str, num_days: int) -> None:
    """通过配置的短信后端发送租户邀请链接。"""
    _get_backend().send_invitation(phone, action_url, num_days)


def send_invitation_cancellation_sms(phone: str, organization_name: str) -> None:
    """通过配置的短信后端发送租户邀请取消通知。"""
    _get_backend().send_invitation_cancellation(phone, organization_name)
