import math
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from apps.ai.runtime.contracts import AIRetentionPolicy

SENSITIVE_KEYS = {"phone", "mobile", "email", "id_number", "api_key", "access_token", "secret"}
SENSITIVE_VALUE_PATTERNS = (
    re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),
    re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)"),
    re.compile(r"\b(?:sk-|Bearer\s+)[A-Za-z0-9._-]{12,}\b", re.IGNORECASE),
)


@dataclass(frozen=True, slots=True)
class RetentionDecision:
    persist_input: bool
    persist_output: bool
    expires_at: datetime | None


def decide_retention(policy: AIRetentionPolicy, *, now: datetime, temporary_hours: int) -> RetentionDecision:
    if policy == AIRetentionPolicy.TEMPORARY:
        return RetentionDecision(True, True, now + timedelta(hours=temporary_hours))
    return RetentionDecision(False, False, None)


def sanitize_safe_summary(summary: dict[str, Any] | None) -> dict[str, Any]:
    if not summary:
        return {}
    cleaned = {}
    for key, value in summary.items():
        if len(cleaned) >= 20 or not isinstance(key, str) or len(key) > 80:
            continue
        if any(fragment in key.lower() for fragment in SENSITIVE_KEYS):
            continue
        if not isinstance(value, (str, int, float, bool, type(None))):
            continue
        if isinstance(value, float) and not math.isfinite(value):
            continue
        if isinstance(value, str) and any(pattern.search(value) for pattern in SENSITIVE_VALUE_PATTERNS):
            continue
        cleaned[key] = value[:200] if isinstance(value, str) else value
    return cleaned
