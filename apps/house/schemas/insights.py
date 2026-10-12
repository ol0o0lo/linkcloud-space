from __future__ import annotations

from datetime import datetime
from typing import Literal

from ninja import Schema


class HouseAIInsightFactOut(Schema):
    id: str
    label: str
    value: str


class HouseAIInsightMissingFieldOut(Schema):
    key: str
    label: str


class HouseAIInsightTextOut(Schema):
    text: str
    fact_ids: list[str]


class HouseAIInsightSignalOut(Schema):
    label: str
    value: str
    tone: Literal["positive", "neutral", "caution"]
    fact_ids: list[str]


class HouseAIInsightAppealPointOut(HouseAIInsightTextOut):
    pass


class HouseAIInsightViewingQuestionOut(Schema):
    text: str
    fact_ids: list[str]
    missing_field_keys: list[str]


class HouseAIInsightContentOut(Schema):
    schema_version: int
    conclusion: HouseAIInsightTextOut
    signals: list[HouseAIInsightSignalOut]
    appeal_points: list[HouseAIInsightAppealPointOut]
    viewing_questions: list[HouseAIInsightViewingQuestionOut]
    missing_fields: list[HouseAIInsightMissingFieldOut]
    facts: list[HouseAIInsightFactOut]


class HouseAIInsightOut(Schema):
    state: Literal["not_generated", "fresh", "expired"]
    insight: HouseAIInsightContentOut | None
    generated_at: datetime | None
    expires_at: datetime | None
    source_changed: bool
