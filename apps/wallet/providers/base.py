from dataclasses import dataclass, field


@dataclass(slots=True)
class ProviderTransferResult:
    provider: str
    out_trade_no: str
    accepted: bool
    status: str
    request_payload: dict = field(default_factory=dict)
    response_payload: dict = field(default_factory=dict)
    provider_trade_no: str = ""
    error_code: str = ""
    error_message: str = ""


@dataclass(slots=True)
class ProviderQueryResult:
    out_trade_no: str
    provider_trade_no: str
    payout_status: str
    response_payload: dict = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""


class BasePayoutProvider:
    code = ""

    def build_transfer_request(self, withdrawal, idempotency_key: str) -> dict:
        raise NotImplementedError

    def create_transfer(self, withdrawal, idempotency_key: str) -> ProviderTransferResult:
        raise NotImplementedError

    def query_transfer(self, payout) -> ProviderQueryResult:
        raise NotImplementedError

    def verify_callback(self, payload: dict, headers: dict, raw_body: str = "") -> bool:
        raise NotImplementedError

    def parse_callback(self, payload: dict, headers: dict, raw_body: str = ""):
        raise NotImplementedError
