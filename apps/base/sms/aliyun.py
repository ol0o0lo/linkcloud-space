import json
import logging

from django.conf import settings

from alibabacloud_dysmsapi20170525 import models as sms_models
from alibabacloud_dysmsapi20170525.client import Client
from alibabacloud_tea_openapi import models as open_api_models

from .base import SMSBackend

logger = logging.getLogger(__name__)


class AliyunSMSBackend(SMSBackend):
    """Aliyun (Alibaba Cloud) SMS backend."""

    def _get_client(self) -> Client:
        config = open_api_models.Config(
            access_key_id=settings.ALIYUN_SMS_ACCESS_KEY_ID,
            access_key_secret=settings.ALIYUN_SMS_ACCESS_KEY_SECRET,
        )
        config.endpoint = "dysmsapi.aliyuncs.com"
        return Client(config)

    def _send_template(self, phone: str, template_code: str, template_params: dict[str, str]) -> None:
        if not template_code:
            raise RuntimeError("阿里云短信模板未配置。")
        try:
            client = self._get_client()
            request = sms_models.SendSmsRequest(
                phone_numbers=phone,
                sign_name=settings.ALIYUN_SMS_SIGN_NAME,
                template_code=template_code,
                template_param=json.dumps(template_params, ensure_ascii=False),
            )
            response = client.send_sms(request)
            if response.body.code != "OK":
                logger.error("Aliyun SMS failed: %s - %s", response.body.code, response.body.message)
                raise RuntimeError(f"Aliyun SMS error: {response.body.code} {response.body.message}")
            logger.info("Aliyun SMS sent to %s", phone)
        except RuntimeError:
            raise  # re-raise our own error as-is
        except Exception as e:
            logger.error("Aliyun SMS SDK exception: %s", str(e))
            raise RuntimeError(f"Aliyun SMS SDK error: {e}") from e

    def send(self, phone: str, code: str) -> None:
        self._send_template(phone, settings.ALIYUN_SMS_TEMPLATE_CODE, {"code": code})

    def send_invitation(self, phone: str, action_url: str, num_days: int) -> None:
        self._send_template(
            phone,
            settings.ALIYUN_SMS_INVITATION_TEMPLATE_CODE,
            {"action_url": action_url, "num_days": str(num_days)},
        )

    def send_invitation_cancellation(self, phone: str, organization_name: str) -> None:
        self._send_template(
            phone,
            settings.ALIYUN_SMS_INVITATION_CANCELLATION_TEMPLATE_CODE,
            {"organization_name": organization_name},
        )
