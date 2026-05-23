import logging

from .base import SMSBackend

logger = logging.getLogger(__name__)


class ConsoleSMSBackend(SMSBackend):
    """Development SMS backend that prints verification codes to the console/log."""

    def send(self, phone: str, code: str) -> None:
        logger.warning("[SMS] To: %s | Code: %s", phone, code)
