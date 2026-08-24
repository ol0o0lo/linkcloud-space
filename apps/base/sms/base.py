from abc import ABC, abstractmethod


class SMSBackend(ABC):
    """短信后端抽象基类。"""

    @abstractmethod
    def send(self, phone: str, code: str) -> None:
        """Send an SMS verification code to the given phone number."""
        raise NotImplementedError

    @abstractmethod
    def send_invitation(self, phone: str, action_url: str, num_days: int) -> None:
        """向指定手机号发送包含接受链接的邀请短信。"""
        raise NotImplementedError

    @abstractmethod
    def send_invitation_cancellation(self, phone: str, organization_name: str) -> None:
        """向指定手机号发送邀请已取消的通知短信。"""
        raise NotImplementedError
