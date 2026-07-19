from datetime import datetime
from typing import Any

from ninja import Schema


class FavoriteOut(Schema):
    id: int
    target_type: str
    target_id: str
    created_at: datetime
    available: bool
    target: dict[str, Any] | None
