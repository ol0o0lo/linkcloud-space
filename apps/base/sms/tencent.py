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

    def send(self, phone: str, code: str) -> None:
        try:
            cred = credential.Credential(
                settings.TENCENT_SMS_SECRET_ID,
                settings.TENCENT_SMS_SECRET_KEY,
            )
            client = sms_client.SmsClient(cred, "ap-guangzhou")
            req = sms_models.SendSmsRequest()
            req.SmsSdkAppId = settings.TENCENT_SMS_APP_ID
            req.SignName = settings.TENCENT_SMS_SIGN_NAME
            req.TemplateId = settings.TENCENT_SMS_TEMPLATE_ID
            req.TemplateParamSet = [code]
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
