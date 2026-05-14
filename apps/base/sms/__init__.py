from django.conf import settings
from django.utils.module_loading import import_string


def send_sms(phone: str, code: str) -> None:
    """Send an SMS using the configured SMS_BACKEND."""
    backend_class = import_string(settings.SMS_BACKEND)
    backend = backend_class()
    backend.send(phone, code)
