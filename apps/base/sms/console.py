import logging

from .base import SMSBackend

logger = logging.getLogger(__name__)


class ConsoleSMSBackend(SMSBackend):
    """Development SMS backend that prints verification codes to the console/log."""

    def send(self, phone: str, code: str) -> None:
        logger.warning("[SMS] To: %s | Code: %s", phone, code)

    def send_invitation(self, phone: str, action_url: str, num_days: int) -> None:
        logger.warning("[SMS] To: %s | Invitation link (valid %s days): %s", phone, num_days, action_url)

    def send_invitation_cancellation(self, phone: str, organization_name: str) -> None:
        logger.warning("[SMS] To: %s | Invitation to %s has been canceled", phone, organization_name)
