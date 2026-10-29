from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ParticipantSpec:
    user_id: int
    access_kind: Literal["organization_member", "business_party"]
