from datetime import datetime

from ninja import Schema
from pydantic import Field


class MemberDetailOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    avatar_url: str | None = None


class TeamOut(Schema):
    id: int
    name: str
    members: list[int]
    member_details: list[MemberDetailOut]
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_members(obj) -> list[int]:
        return [u.pk for u in obj.members.all()]

    @staticmethod
    def resolve_member_details(obj) -> list[MemberDetailOut]:
        return [
            MemberDetailOut(
                id=u.pk,
                username=u.username,
                first_name=u.first_name,
                last_name=u.last_name,
                avatar_url=u.avatar_url,
            )
            for u in obj.members.all()
        ]


class TeamIn(Schema):
    name: str = Field(..., description="团队名称。")
    members: list[int] = Field(default_factory=list, description="初始成员用户 ID 列表。")


class TeamPatchIn(Schema):
    name: str | None = Field(None, description="新的团队名称。")
    members: list[int] | None = Field(None, description="新的团队成员用户 ID 列表。")
