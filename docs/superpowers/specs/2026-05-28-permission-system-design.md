# 权限体系设计

**日期**: 2026-05-28  
**状态**: 已确认，待实现

---

## 背景

项目是 SaaS 多租户平台，当前权限体系只有 `OrganizationMember.is_owner` 布尔值区分 Org 成员角色，无法支持：

- Org 级业务角色（如全局财务，管理所有 Team 的业务）
- Team 级角色（如 Team 财务，只处理本 Team 业务）
- Team 资源可见性控制（某资源只对所在 Team 可见）

---

## 目标

- Org + Team 双层权限
- 支持"全局角色"和"Team 级角色"两种范围
- 对现有代码侵入最小（`is_owner` 保留不动）

---

## 数据模型

### OrganizationMember — 新增 `role` 字段

```python
class OrganizationMember(OrganizationRoleMixin, TimeStampModelMixin):
    organization = ForeignKey(...)
    user = ForeignKey(...)
    is_primary = BooleanField(...)
    is_owner = BooleanField(...)   # 保留，控制 Org 管理权

    # 新增：控制 Org 级业务权限，范围 = 整个 Org
    role = CharField(
        max_length=20,
        choices=[("member", "普通成员"), ("finance", "财务"), ...],
        default="member",
    )
```

### TeamMember — 新增中间表

将 `Team.members` 的裸 M2M 替换为 `through=TeamMember`，以便在成员关系上附加 `role`。

```python
class TeamMember(TimeStampModelMixin):
    team = ForeignKey("teams.Team", on_delete=CASCADE)
    user = ForeignKey(settings.AUTH_USER_MODEL, on_delete=CASCADE)
    role = CharField(
        max_length=20,
        choices=[("admin", "管理员"), ("member", "成员"), ("finance", "财务"), ...],
        default="member",
    )

    class Meta:
        unique_together = ("team", "user")

class Team(TimeStampModelMixin, Model):
    organization = ForeignKey(...)
    name = CharField(...)
    members = ManyToManyField(
        settings.AUTH_USER_MODEL,
        through=TeamMember,
        blank=True,
        related_name="teams",
    )
```

---

## 权限层级

| 层级 | 字段 | 范围 |
|---|---|---|
| Org 管理权 | `OrganizationMember.is_owner=True` | 整个 Org，管理成员/设置等 |
| Org 业务权 | `OrganizationMember.role` | 整个 Org（如全局财务可查所有 Team 账单） |
| Team 业务权 | `TeamMember.role` | 仅限自己的 Team |

---

## 权限检查逻辑

`apps/base/permissions.py` 新增以下函数：

```python
def require_org_role(request, role: str) -> OrganizationMember:
    """检查用户在当前 Org 的业务角色。"""

def require_team_member(request, team) -> TeamMember:
    """检查用户是否是指定 Team 的成员。"""

def require_team_role(request, team, role: str) -> TeamMember:
    """检查用户在指定 Team 的业务角色。"""

def require_finance(request, team=None):
    """
    全局财务（OrgMember.role=finance）OR 指定 Team 的财务（TeamMember.role=finance）。
    team=None 时只检查全局财务。
    """
```

### 典型使用示例

```python
# 全局财务 or Team 财务都能访问
@router.get("/bills/")
def list_bills(request, team_id: int):
    team = get_object_or_404(...)
    require_finance(request, team=team)

    if has_org_role(request.user, request.org, "finance"):
        return Bill.objects.filter(org=request.org)
    else:
        return Bill.objects.filter(team=team)
```

---

## 资源可见性

业务资源（如链接、账单）通过 `team` 外键关联到 Team，查询时自动过滤：

```python
# 查询当前用户能看到的资源
Resource.objects.filter(team__teammember__user=request.user)
```

---

## 改动文件清单

| 文件 | 改动说明 |
|---|---|
| `apps/organizations/models.py` | `OrganizationMember` 新增 `role` 字段 |
| `apps/organizations/migrations/` | 新增迁移 |
| `apps/teams/models.py` | 新增 `TeamMember` 模型，`Team.members` 加 `through=TeamMember` |
| `apps/teams/migrations/` | 新增迁移（含数据迁移，现有成员默认 role=member） |
| `apps/teams/api.py` | `members.set()` 改为操作 `TeamMember`；prefetch 调整 |
| `apps/teams/schemas.py` | 成员列表从 `list[int]` 扩展为带 `role` 的结构 |
| `apps/settings/api.py` | 1 处 `team.members.filter` 改为 `TeamMember` 查询 |
| `apps/base/permissions.py` | 新增 4 个权限函数 |
| `apps/teams/admin.py` | 注册 `TeamMember` inline |
| `apps/teams/tests/test_api.py` | 更新相关断言 |

---

## 不改动的内容

- `OrganizationMember.is_owner` — 保留，现有 `require_org_owner` 逻辑不动
- Org 层其他逻辑（`require_org_selected` 等）— 不变
- `OrganizationInvite` — 不变
