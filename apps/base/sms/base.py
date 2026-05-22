from abc import ABC, abstractmethod


class SMSBackend(ABC):
    """Abstract base class for SMS backends."""


    @abstractmethod
    def send(self, phone: str, code: str) -> None:
        """Send an SMS verification code to the given phone number."""
        raise NotImplementedError
