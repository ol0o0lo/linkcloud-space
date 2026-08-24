import logging

from django.conf import settings

from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.sms.v20210111 import models as sms_models
from tencentcloud.sms.v20210111 import sms_client

from .base import SMSBackend

logger = logging.getLogger(__name__)


class TencentSMSBackend(SMSBackend):
    """Tencent Cloud SMS backend."""

    def _send_template(self, phone: str, template_id: str, template_params: list[str]) -> None:
        if not template_id:
            raise RuntimeError("腾讯云短信模板未配置。")
        try:
            cred = credential.Credential(
                settings.TENCENT_SMS_SECRET_ID,
                settings.TENCENT_SMS_SECRET_KEY,
            )
            client = sms_client.SmsClient(cred, "ap-guangzhou")
            req = sms_models.SendSmsRequest()
            req.SmsSdkAppId = settings.TENCENT_SMS_APP_ID
            req.SignName = settings.TENCENT_SMS_SIGN_NAME
            req.TemplateId = template_id
            req.TemplateParamSet = template_params
            req.PhoneNumberSet = [phone if phone.startswith("+") else f"+86{phone}"]
            resp = client.SendSms(req)
            status = resp.SendStatusSet[0]
            if status.Code != "Ok":
                logger.error("Tencent SMS failed: %s - %s", status.Code, status.Message)
                raise RuntimeError(f"Tencent SMS error: {status.Code} {status.Message}")
            logger.info("Tencent SMS sent to %s", phone)
        except TencentCloudSDKException as e:
            logger.error("Tencent SMS SDK exception: %s", str(e))
            raise RuntimeError(f"Tencent SMS SDK error: {e}") from e

    def send(self, phone: str, code: str) -> None:
        self._send_template(phone, settings.TENCENT_SMS_TEMPLATE_ID, [code])

    def send_invitation(self, phone: str, action_url: str, num_days: int) -> None:
        self._send_template(phone, settings.TENCENT_SMS_INVITATION_TEMPLATE_ID, [action_url, str(num_days)])

    def send_invitation_cancellation(self, phone: str, organization_name: str) -> None:
        self._send_template(phone, settings.TENCENT_SMS_INVITATION_CANCELLATION_TEMPLATE_ID, [organization_name])
