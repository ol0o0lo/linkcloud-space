# Organization & Team 创建 Hooks 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在创建 Organization 和 Team 时注入 pre/post hook，留空逻辑供后续付费等级限制使用。

**Architecture:** 在 `apps/base/errors.py` 新增 `QuotaExceededError` 自定义异常并注册 402 handler；分别在 `apps/organizations/hooks.py` 和 `apps/teams/hooks.py` 中定义 `pre_create_*` / `post_create_*` 四个 hook 函数（函数体留空）；在对应 api.py 中显式调用这两个 hook。

**Tech Stack:** Django-Ninja, Python 3.12

---

### Task 1: 新增 `QuotaExceededError` 并注册 handler

**Files:**
- Modify: `apps/base/errors.py`

- [ ] **Step 1: 在 `apps/base/errors.py` 末尾新增异常类**

在文件最后的 `register_error_handlers` 函数**上方**新增：

```python
class QuotaExceededError(Exception):
    """
    创建资源时超出配额限制。

    留空供后续付费等级逻辑填充——在 pre_create_* hook 中 raise 此异常。
    默认返回 HTTP 402 Payment Required。
    """

    def __init__(self, message: str = "已达到创建上限。"):
        self.message = message
        super().__init__(message)
```

- [ ] **Step 2: 在 `register_error_handlers` 中注册 handler**

在 `register_error_handlers` 函数内、`_http_error` handler 之前添加：

```python
    @api.exception_handler(QuotaExceededError)
    def _quota_exceeded(request, exc):
        return JsonResponse({"detail": exc.message}, status=402)
```

- [ ] **Step 3: 写测试**

在 `apps/base/tests/` 目录下新建（或找到现有） `test_errors.py`，添加：

```python
import pytest
from django.test import RequestFactory

from apps.base.errors import QuotaExceededError


def test_quota_exceeded_error_default_message():
    exc = QuotaExceededError()
    assert exc.message == "已达到创建上限。"
    assert str(exc) == "已达到创建上限。"


def test_quota_exceeded_error_custom_message():
    exc = QuotaExceededError("组织数量已达上限，请升级套餐。")
    assert exc.message == "组织数量已达上限，请升级套餐。"
```

- [ ] **Step 4: 运行测试确认通过**

```bash
docker compose exec web pytest apps/base/tests/test_errors.py -v
```

期望：全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/base/errors.py apps/base/tests/test_errors.py
git commit -m "feat: 新增 QuotaExceededError 及 402 handler"
```

---

### Task 2: 新建 `apps/organizations/hooks.py`

**Files:**
- Create: `apps/organizations/hooks.py`

- [ ] **Step 1: 创建文件**

```python
# apps/organizations/hooks.py
"""
Organization 创建 Hook。

pre_create_organization  — 创建前调用，可 raise QuotaExceededError 阻止创建。
post_create_organization — 创建后调用（在 transaction.atomic 内），用于后续初始化。

当前逻辑留空，后续根据用户付费等级填充配额检查及初始化逻辑。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest

    from apps.organizations.models import Organization


def pre_create_organization(request: "HttpRequest") -> None:
    """
    创建组织前调用。

    后续在此处根据 request.user 的付费等级检查可创建组织数量上限，
    超限时 raise QuotaExceededError("组织数量已达上限，请升级套餐。")
    """
    pass  # TODO: 付费等级配额检查


def post_create_organization(request: "HttpRequest", org: "Organization") -> None:
    """
    创建组织后调用（位于 transaction.atomic 内，org 已持久化）。

    后续可在此处触发初始化动作，例如：开通默认功能、写入审计日志、
    发送欢迎通知等。
    """
    pass  # TODO: 创建后初始化逻辑
```

- [ ] **Step 2: 写测试**

新建 `apps/organizations/tests/test_hooks.py`：

```python
import pytest
from django.test import RequestFactory

from apps.organizations.hooks import post_create_organization, pre_create_organization


@pytest.fixture
def request_with_user(db):
    from model_bakery import baker
    factory = RequestFactory()
    request = factory.post("/")
    request.user = baker.make("accounts.User")
    return request


def test_pre_create_organization_is_noop(request_with_user):
    """当前为空实现，不应抛出任何异常。"""
    result = pre_create_organization(request_with_user)
    assert result is None


def test_post_create_organization_is_noop(db, request_with_user):
    from model_bakery import baker
    org = baker.make("organizations.Organization")
    result = post_create_organization(request_with_user, org)
    assert result is None
```

- [ ] **Step 3: 运行测试确认通过**

```bash
docker compose exec web pytest apps/organizations/tests/test_hooks.py -v
```

期望：全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/organizations/hooks.py apps/organizations/tests/test_hooks.py
git commit -m "feat: 新增 organizations pre/post create hook（留空）"
```

---

### Task 3: 新建 `apps/teams/hooks.py`

**Files:**
- Create: `apps/teams/hooks.py`

- [ ] **Step 1: 创建文件**

```python
# apps/teams/hooks.py
"""
Team 创建 Hook。

pre_create_team  — 创建前调用，可 raise QuotaExceededError 阻止创建。
post_create_team — 创建后调用（在 transaction.atomic 内），用于后续初始化。

当前逻辑留空，后续根据用户付费等级填充配额检查及初始化逻辑。
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest

    from apps.teams.models import Team


def pre_create_team(request: "HttpRequest") -> None:
    """
    创建团队前调用。

    后续在此处根据 request.user / request.org 的付费等级检查可创建团队数量上限，
    超限时 raise QuotaExceededError("团队数量已达上限，请升级套餐。")
    """
    pass  # TODO: 付费等级配额检查


def post_create_team(request: "HttpRequest", team: "Team") -> None:
    """
    创建团队后调用（位于 transaction.atomic 内，team 已持久化）。

    后续可在此处触发初始化动作，例如：写入审计日志、发送通知等。
    """
    pass  # TODO: 创建后初始化逻辑
```

- [ ] **Step 2: 写测试**

新建 `apps/teams/tests/test_hooks.py`：

```python
import pytest
from django.test import RequestFactory

from apps.teams.hooks import post_create_team, pre_create_team


@pytest.fixture
def request_with_user(db):
    from model_bakery import baker
    factory = RequestFactory()
    request = factory.post("/")
    request.user = baker.make("accounts.User")
    return request


def test_pre_create_team_is_noop(request_with_user):
    """当前为空实现，不应抛出任何异常。"""
    result = pre_create_team(request_with_user)
    assert result is None


def test_post_create_team_is_noop(db, request_with_user):
    from model_bakery import baker
    org = baker.make("organizations.Organization")
    team = baker.make("teams.Team", organization=org)
    result = post_create_team(request_with_user, team)
    assert result is None
```

- [ ] **Step 3: 运行测试确认通过**

```bash
docker compose exec web pytest apps/teams/tests/test_hooks.py -v
```

期望：全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/teams/hooks.py apps/teams/tests/test_hooks.py
git commit -m "feat: 新增 teams pre/post create hook（留空）"
```

---

### Task 4: 在 `create_organization` API 中调用 hooks

**Files:**
- Modify: `apps/organizations/api.py`

- [ ] **Step 1: 导入 hooks**

在 `apps/organizations/api.py` 顶部现有 import 区域末尾添加：

```python
from apps.organizations.hooks import post_create_organization, pre_create_organization
```

- [ ] **Step 2: 修改 `create_organization` 函数**

将原来的：

```python
@orgs_router.post("/", response={201: OrganizationCreateOut})
def create_organization(request, payload: OrganizationCreateIn):
    require_authenticated(request)
    with transaction.atomic():
        org = Organization.objects.create(name=payload.name, slug=payload.slug)
        OrganizationMember.objects.create(organization=org, user=request.user, is_owner=True, is_primary=True)
    save_org_data(request, org)
    return Status(201, {"id": org.pk, "name": org.name, "slug": org.slug})
```

替换为：

```python
@orgs_router.post("/", response={201: OrganizationCreateOut})
def create_organization(request, payload: OrganizationCreateIn):
    require_authenticated(request)
    pre_create_organization(request)
    with transaction.atomic():
        org = Organization.objects.create(name=payload.name, slug=payload.slug)
        OrganizationMember.objects.create(organization=org, user=request.user, is_owner=True, is_primary=True)
        post_create_organization(request, org)
    save_org_data(request, org)
    return Status(201, {"id": org.pk, "name": org.name, "slug": org.slug})
```

- [ ] **Step 3: 运行现有 org API 测试确认没有回归**

```bash
docker compose exec web pytest apps/organizations/tests/test_api.py -v
```

期望：全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/organizations/api.py
git commit -m "feat: create_organization 接入 pre/post hook"
```

---

### Task 5: 在 `create_team` API 中调用 hooks

**Files:**
- Modify: `apps/teams/api.py`

- [ ] **Step 1: 导入 hooks**

在 `apps/teams/api.py` 顶部现有 import 区域末尾添加：

```python
from apps.teams.hooks import post_create_team, pre_create_team
```

- [ ] **Step 2: 修改 `create_team` 函数**

将原来的：

```python
@router.post("/", response={201: TeamOut})
def create_team(request, payload: TeamIn):
    org = require_org_owner(request)
    member_ids = _validate_members(payload.members, org)
    team = Team.objects.create(organization=org, name=payload.name)
    if member_ids:
        team.members.set(member_ids)
    return Status(201, team)
```

替换为：

```python
@router.post("/", response={201: TeamOut})
def create_team(request, payload: TeamIn):
    org = require_org_owner(request)
    member_ids = _validate_members(payload.members, org)
    pre_create_team(request)
    with transaction.atomic():
        team = Team.objects.create(organization=org, name=payload.name)
        if member_ids:
            team.members.set(member_ids)
        post_create_team(request, team)
    return Status(201, team)
```

注意：原来 `create_team` 没有 `transaction.atomic()`，这里一并补上，使 post hook 能与主写操作同一事务。

- [ ] **Step 3: 运行现有 teams API 测试确认没有回归**

```bash
docker compose exec web pytest apps/teams/tests/test_api.py -v
```

期望：全部 PASS。

- [ ] **Step 4: 运行全量测试**

```bash
docker compose exec web pytest --ignore=e2e -v
```

期望：全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/teams/api.py
git commit -m "feat: create_team 接入 pre/post hook，补充 transaction.atomic"
```
