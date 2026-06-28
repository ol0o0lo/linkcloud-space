# 枚举映射契约 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 后端为所有对外 API 枚举字段返回 `<field>__mapping`，并提供统一 `/api/enums/` 给前端筛选下拉获取全量枚举选项。

**Architecture:** 后端在 `apps.base` 增加显式枚举 registry 和序列化 helper；各业务 schema 只补必要 `__mapping` resolver，不改分页响应结构。前端新增一个手写 enum metadata service/hook，页面展示使用 `xxx__mapping`，筛选 options 从 `/api/enums/` 取。

**Tech Stack:** Django 5, django-ninja, Pydantic/Ninja Schema, React, Umi Max request, React Query, Ant Design/ProTable, pytest, Vitest。

---

## File Structure

- Create: `apps/base/enum_registry.py`
  - 负责显式注册可暴露枚举、生成 options、生成单值 mapping。
- Modify: `apps/base/api.py`
  - 增加 `GET /api/enums/`。
- Modify: `apps/accounts/schemas.py`, `apps/accounts/services.py`
  - 给实名相关输出补 `__mapping`。
- Modify: `apps/house/schemas.py`
  - 给房源、带看、租约、项目枚举输出补 `__mapping`。
- Modify: `apps/wallet/schemas.py`
  - 给钱包流水、提现、打款枚举输出补 `__mapping`。
- Modify: `apps/notifications/schemas.py`
  - 给通知分发枚举输出补 `__mapping`。
- Modify: `apps/referrals/schemas.py`
  - 给推广记录和规则配置枚举输出补 `__mapping`。
- Test: `tests/base/test_enum_registry_api.py`
  - 覆盖枚举接口和未知 key。
- Test existing API files:
  - `tests/accounts/test_admin_user_lifecycle_api.py`
  - `tests/house/test_api.py`
  - `tests/wallet/test_api.py`
  - `tests/notifications/test_dispatches_api.py`
  - `tests/referrals/test_api.py`
- Create: `frontend_admin/src/services/manual/enums.ts`
  - 前端枚举元数据查询和 options 转换。
- Modify focused frontend pages:
  - `frontend_admin/src/pages/platform-management/users/index.tsx`
  - `frontend_admin/src/pages/platform-management/real-name/index.tsx`
  - `frontend_admin/src/pages/property-rental/constants.ts`
  - `frontend_admin/src/pages/property-rental/estates/index.tsx`
  - `frontend_admin/src/pages/property-rental/houses/index.tsx`
  - `frontend_admin/src/pages/property-rental/houses/detail.tsx`
  - `frontend_admin/src/pages/property-rental/houses/new.tsx`
  - `frontend_admin/src/pages/property-rental/viewings/index.tsx`
  - `frontend_admin/src/pages/property-rental/leases/index.tsx`
  - `frontend_admin/src/pages/property-rental/contacts/index.tsx`
  - `frontend_admin/src/pages/wallet-management/accounts/index.tsx`
  - `frontend_admin/src/pages/wallet-management/withdrawals/index.tsx`
  - `frontend_admin/src/pages/personal-business/overview/index.tsx`
  - `frontend_admin/src/pages/platform-management/notifications/index.tsx`
  - `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`
  - `frontend_admin/src/pages/platform-management/referrals/index.tsx`
- Test focused frontend files already colocated with those pages.

## Backend enum keys

Register these keys in `apps/base/enum_registry.py`:

```python
def enum_registry():
    from apps.access.constants import AccessPermission, AccessRoleCode, AccessScope, FinancePermission, OrganizationPermission, SettingsPermission, TeamPermission
    from apps.accounts.constants import RealNameIdCardSide, RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
    from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus
    from apps.media.constants import MediaExtension, MediaScope, MediaType, ResourceType
    from apps.notifications.constants import NotificationChannel
    from apps.notifications.models import NotificationDispatch
    from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
    from apps.settings.constants import SettingWidget, ValueType
    from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus

    return {
        "access.scope": AccessScope,
        "access.role_code": AccessRoleCode,
        "access.permission": AccessPermission,
        "access.organization_permission": OrganizationPermission,
        "access.team_permission": TeamPermission,
        "access.settings_permission": SettingsPermission,
        "access.finance_permission": FinancePermission,
        "accounts.real_name_status": RealNameStatus,
        "accounts.real_name_source": RealNameSource,
        "accounts.real_name_provider": RealNameProvider,
        "accounts.real_name_log_action": RealNameLogAction,
        "accounts.real_name_id_card_side": RealNameIdCardSide,
        "house.estate_property_type": EstatePropertyType,
        "house.contact_role": ContactRole,
        "house.house_orientation": HouseOrientation,
        "house.house_decoration": HouseDecoration,
        "house.house_status": HouseStatus,
        "house.house_publish_status": HousePublishStatus,
        "house.viewing_record_status": ViewingRecordStatus,
        "house.lease_status": LeaseStatus,
        "media.scope": MediaScope,
        "media.extension": MediaExtension,
        "media.resource_type": ResourceType,
        "media.media_type": MediaType,
        "notifications.channel": NotificationChannel,
        "notifications.dispatch_scope": NotificationDispatch.Scope,
        "notifications.dispatch_status": NotificationDispatch.Status,
        "referrals.record_status": ReferralRecordStatus,
        "referrals.display_level": ReferralDisplayLevel,
        "referrals.trigger_event": ReferralTriggerEvent,
        "settings.value_type": ValueType,
        "settings.widget": SettingWidget,
        "wallet.entry_type": WalletEntryType,
        "wallet.withdrawal_pay_channel": WithdrawalPayChannel,
        "wallet.withdrawal_status": WithdrawalStatus,
        "wallet.payout_status": PayoutStatus,
    }
```

---

### Task 1: Backend enum registry and `/api/enums/`

**Files:**
- Create: `apps/base/enum_registry.py`
- Modify: `apps/base/api.py`
- Test: `tests/base/test_enum_registry_api.py`

- [ ] **Step 1: Write failing registry/API tests**

Create `tests/base/test_enum_registry_api.py`:

```python
from django.test import TestCase

from tests.api_helpers import api_data


class TestEnumRegistryAPI(TestCase):
    def test_list_selected_enums(self):
        response = self.client.get("/api/enums/", {"keys": "accounts.real_name_status,wallet.withdrawal_status"})

        data = api_data(response)

        assert data["accounts.real_name_status"][0] == {"value": "unverified", "mapping": "未实名"}
        assert {"value": "verified", "mapping": "已实名"} in data["accounts.real_name_status"]
        assert {"value": "pending_review", "mapping": "待审核"} in data["wallet.withdrawal_status"]

    def test_list_all_enums_when_keys_missing(self):
        response = self.client.get("/api/enums/")

        data = api_data(response)

        assert "accounts.real_name_status" in data
        assert "house.house_status" in data
        assert "wallet.withdrawal_status" in data

    def test_unknown_enum_key_returns_400(self):
        response = self.client.get("/api/enums/", {"keys": "missing.status"})

        assert response.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
docker compose exec web pytest tests/base/test_enum_registry_api.py -q
```

Expected: FAIL because `/api/enums/` is not defined.

- [ ] **Step 3: Add enum registry helper**

Create `apps/base/enum_registry.py`:

```python
from functools import cache
from typing import Any

from ninja.errors import HttpError


def _label(enum_cls: Any, value: Any) -> str:
    if hasattr(enum_cls, "get_choice_label"):
        return str(enum_cls.get_choice_label(value))
    try:
        return str(enum_cls(value).label)
    except ValueError:
        return str(value)


def enum_mapping(enum_cls: Any, value: Any) -> str:
    if value is None:
        return ""
    return _label(enum_cls, value)


def enum_list_mapping(enum_cls: Any, values: list[Any] | tuple[Any, ...] | None) -> list[str]:
    return [enum_mapping(enum_cls, value) for value in (values or [])]


def enum_options(enum_cls: Any) -> list[dict[str, str]]:
    return [{"value": str(value), "mapping": str(label)} for value, label in enum_cls.choices]


@cache
def enum_registry() -> dict[str, Any]:
    from apps.access.constants import AccessPermission, AccessRoleCode, AccessScope, FinancePermission, OrganizationPermission, SettingsPermission, TeamPermission
    from apps.accounts.constants import RealNameIdCardSide, RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
    from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus
    from apps.media.constants import MediaExtension, MediaScope, MediaType, ResourceType
    from apps.notifications.constants import NotificationChannel
    from apps.notifications.models import NotificationDispatch
    from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
    from apps.settings.constants import SettingWidget, ValueType
    from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus

    return {
        "access.scope": AccessScope,
        "access.role_code": AccessRoleCode,
        "access.permission": AccessPermission,
        "access.organization_permission": OrganizationPermission,
        "access.team_permission": TeamPermission,
        "access.settings_permission": SettingsPermission,
        "access.finance_permission": FinancePermission,
        "accounts.real_name_status": RealNameStatus,
        "accounts.real_name_source": RealNameSource,
        "accounts.real_name_provider": RealNameProvider,
        "accounts.real_name_log_action": RealNameLogAction,
        "accounts.real_name_id_card_side": RealNameIdCardSide,
        "house.estate_property_type": EstatePropertyType,
        "house.contact_role": ContactRole,
        "house.house_orientation": HouseOrientation,
        "house.house_decoration": HouseDecoration,
        "house.house_status": HouseStatus,
        "house.house_publish_status": HousePublishStatus,
        "house.viewing_record_status": ViewingRecordStatus,
        "house.lease_status": LeaseStatus,
        "media.scope": MediaScope,
        "media.extension": MediaExtension,
        "media.resource_type": ResourceType,
        "media.media_type": MediaType,
        "notifications.channel": NotificationChannel,
        "notifications.dispatch_scope": NotificationDispatch.Scope,
        "notifications.dispatch_status": NotificationDispatch.Status,
        "referrals.record_status": ReferralRecordStatus,
        "referrals.display_level": ReferralDisplayLevel,
        "referrals.trigger_event": ReferralTriggerEvent,
        "settings.value_type": ValueType,
        "settings.widget": SettingWidget,
        "wallet.entry_type": WalletEntryType,
        "wallet.withdrawal_pay_channel": WithdrawalPayChannel,
        "wallet.withdrawal_status": WithdrawalStatus,
        "wallet.payout_status": PayoutStatus,
    }


def selected_enum_options(keys: str | None = None) -> dict[str, list[dict[str, str]]]:
    registry = enum_registry()
    selected_keys = [item.strip() for item in (keys or "").split(",") if item.strip()]
    if not selected_keys:
        selected_keys = sorted(registry)
    unknown = [key for key in selected_keys if key not in registry]
    if unknown:
        raise HttpError(400, f"Unknown enum key: {', '.join(unknown)}")
    return {key: enum_options(registry[key]) for key in selected_keys}
```

- [ ] **Step 4: Add API route**

Modify `apps/base/api.py` imports:

```python
from apps.base.enum_registry import selected_enum_options
```

Add route after `get_version`:

```python
@router.get("/enums/", auth=None, summary="获取后端枚举映射")
def list_enums(request, keys: str | None = None):
    """返回前端筛选和回显需要的后端枚举值。"""
    return selected_enum_options(keys)
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
docker compose exec web pytest tests/base/test_enum_registry_api.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/base/api.py apps/base/enum_registry.py tests/base/test_enum_registry_api.py
git commit -m "feat: 增加枚举映射接口"
```

---

### Task 2: Add `__mapping` fields to account schemas

**Files:**
- Modify: `apps/accounts/schemas.py`
- Modify: `apps/accounts/services.py`
- Test: `tests/accounts/test_admin_user_lifecycle_api.py`
- Test: `tests/accounts/test_real_name_api.py`

- [ ] **Step 1: Write failing account output assertions**

In `tests/accounts/test_admin_user_lifecycle_api.py`, extend the admin user list test:

```python
def test_superuser_can_list_admin_users_with_mapping(self):
    response = self.client.get("/api/admin/users/")

    rows = api_data(response)["items"]
    member = next(row for row in rows if row["username"] == "member")

    self.assertEqual(member["real_name_status"], "unverified")
    self.assertEqual(member["real_name_status__mapping"], "未实名")
```

In `tests/accounts/test_real_name_api.py`, add an assertion to an existing real-name response test:

```python
assert data["status__mapping"] == data["status_label"]
assert data["source__mapping"] == data["source_label"]
assert data["provider__mapping"] == data["provider_label"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
docker compose exec web pytest tests/accounts/test_admin_user_lifecycle_api.py tests/accounts/test_real_name_api.py -q
```

Expected: FAIL with missing `real_name_status__mapping` or `status__mapping`.

- [ ] **Step 3: Add schema fields and resolvers**

Modify imports in `apps/accounts/schemas.py`:

```python
from apps.accounts.constants import RealNameIdCardSide, RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
from apps.base.enum_registry import enum_mapping
```

Add to `UserOut`:

```python
    real_name_status__mapping: str = ""

    @staticmethod
    def resolve_real_name_status__mapping(obj):
        return enum_mapping(RealNameStatus, obj.real_name_status)
```

Add to `MeOut`:

```python
    real_name_status__mapping: str
```

Add to `RealNameLogOut`:

```python
    action__mapping: str = ""
    from_status__mapping: str = ""
    to_status__mapping: str = ""
```

Add to `RealNameVerificationOut`:

```python
    status__mapping: str
    source__mapping: str
    provider__mapping: str
```

- [ ] **Step 4: Return mapping values in manual dict serializers**

Modify `apps/accounts/services.py` where real-name rows are built:

```python
"action__mapping": RealNameLogAction.get_choice_label(log.action),
"from_status__mapping": RealNameStatus.get_choice_label(log.from_status) if log.from_status else "",
"to_status__mapping": RealNameStatus.get_choice_label(log.to_status) if log.to_status else "",
```

Modify `serialize_real_name_verification` payload:

```python
"status__mapping": RealNameStatus.get_choice_label(verification.status),
"source__mapping": RealNameSource.get_choice_label(verification.source),
"provider__mapping": RealNameProvider.get_choice_label(verification.provider),
```

Modify `apps/accounts/api.py` `get_me` dict:

```python
"real_name_status__mapping": RealNameStatus.get_choice_label(request.user.real_name_status),
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
docker compose exec web pytest tests/accounts/test_admin_user_lifecycle_api.py tests/accounts/test_real_name_api.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/accounts/api.py apps/accounts/schemas.py apps/accounts/services.py tests/accounts/test_admin_user_lifecycle_api.py tests/accounts/test_real_name_api.py
git commit -m "feat: 增加账户枚举映射"
```

---

### Task 3: Add `__mapping` fields to house schemas

**Files:**
- Modify: `apps/house/schemas.py`
- Test: `tests/house/test_api.py`

- [ ] **Step 1: Write failing house API assertions**

Add assertions to existing house API list/detail tests:

```python
estate = api_data(self.client.get("/api/house/estates/"))["items"][0]
self.assertEqual(estate["property_type__mapping"], "住宅")

house = api_data(self.client.get("/api/house/houses/"))["items"][0]
self.assertEqual(house["status__mapping"], "空置")
self.assertEqual(house["publish_status__mapping"], "草稿")

viewing = api_data(self.client.get("/api/house/viewing-records/"))["items"][0]
self.assertEqual(viewing["status__mapping"], "已预约")

lease = api_data(self.client.get("/api/house/leases/"))["items"][0]
self.assertEqual(lease["status__mapping"], "待生效")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
docker compose exec web pytest tests/house/test_api.py -q
```

Expected: FAIL with missing mapping keys.

- [ ] **Step 3: Add imports**

Modify `apps/house/schemas.py` imports:

```python
from apps.base.enum_registry import enum_list_mapping, enum_mapping
from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus
```

- [ ] **Step 4: Add mapping fields to output schemas**

Add to `EstateOut`:

```python
    property_type__mapping: str

    @staticmethod
    def resolve_property_type__mapping(obj):
        return enum_mapping(EstatePropertyType, obj.property_type)
```

Add to `ContactOut`:

```python
    roles__mapping: list[str]

    @staticmethod
    def resolve_roles__mapping(obj):
        return enum_list_mapping(ContactRole, obj.roles)
```

Add to `HouseOut`:

```python
    orientation__mapping: str
    decoration__mapping: str
    status__mapping: str
    publish_status__mapping: str

    @staticmethod
    def resolve_orientation__mapping(obj):
        return enum_mapping(HouseOrientation, obj.orientation)

    @staticmethod
    def resolve_decoration__mapping(obj):
        return enum_mapping(HouseDecoration, obj.decoration)

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(HouseStatus, obj.status)

    @staticmethod
    def resolve_publish_status__mapping(obj):
        return enum_mapping(HousePublishStatus, obj.publish_status)
```

Add to `ViewingRecordOut`:

```python
    status__mapping: str

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(ViewingRecordStatus, obj.status)
```

Add to `LeaseOut`:

```python
    status__mapping: str

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(LeaseStatus, obj.status)
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
docker compose exec web pytest tests/house/test_api.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/house/schemas.py tests/house/test_api.py
git commit -m "feat: 增加房源枚举映射"
```

---

### Task 4: Add `__mapping` fields to wallet, notification, and referral schemas

**Files:**
- Modify: `apps/wallet/schemas.py`
- Modify: `apps/notifications/schemas.py`
- Modify: `apps/referrals/schemas.py`
- Test: `tests/wallet/test_api.py`
- Test: `tests/notifications/test_dispatches_api.py`
- Test: `tests/referrals/test_api.py`

- [ ] **Step 1: Write failing API assertions**

In wallet API tests assert:

```python
withdrawal = api_data(self.client.get("/api/admin/wallet/withdrawals/"))["items"][0]
self.assertEqual(withdrawal["status__mapping"], "待审核")
self.assertEqual(withdrawal["pay_channel__mapping"], "微信提现")
```

In notification dispatch API tests assert:

```python
dispatch = api_data(self.client.get("/api/notification-dispatches/"))["items"][0]
self.assertEqual(dispatch["scope__mapping"], "Platform")
self.assertEqual(dispatch["status__mapping"], "Pending")
```

In referral API tests assert:

```python
record = api_data(self.client.get("/api/admin/referrals/records/"))["items"][0]
self.assertEqual(record["status__mapping"], "已注册")
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py tests/notifications/test_dispatches_api.py tests/referrals/test_api.py -q
```

Expected: FAIL with missing mapping fields.

- [ ] **Step 3: Add wallet mappings**

Modify `apps/wallet/schemas.py` imports:

```python
from apps.base.enum_registry import enum_mapping
from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus
```

Add to `WalletLedgerOut`:

```python
    entry_type__mapping: str

    @staticmethod
    def resolve_entry_type__mapping(obj):
        return enum_mapping(WalletEntryType, obj.entry_type)
```

Add to `WithdrawalOut`:

```python
    status__mapping: str
    pay_channel__mapping: str

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(WithdrawalStatus, obj.status)

    @staticmethod
    def resolve_pay_channel__mapping(obj):
        return enum_mapping(WithdrawalPayChannel, obj.pay_channel)
```

Add to `WithdrawalPayoutOut`:

```python
    status__mapping: str

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(PayoutStatus, obj.status)
```

- [ ] **Step 4: Add notification mappings**

Modify `apps/notifications/schemas.py` imports:

```python
from apps.base.enum_registry import enum_list_mapping, enum_mapping
from apps.notifications.constants import NotificationChannel
from apps.notifications.models import NotificationDispatch
```

Add to `NotificationPreferenceOut`:

```python
    default_channels__mapping: list[str]

    @staticmethod
    def resolve_default_channels__mapping(obj):
        return enum_list_mapping(NotificationChannel, obj.default_channels)
```

Add to `NotificationDispatchOut`:

```python
    scope__mapping: str
    status__mapping: str

    @staticmethod
    def resolve_scope__mapping(obj):
        return enum_mapping(NotificationDispatch.Scope, obj.scope)

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(NotificationDispatch.Status, obj.status)
```

- [ ] **Step 5: Add referral mappings**

Modify `apps/referrals/schemas.py` imports:

```python
from apps.base.enum_registry import enum_mapping
from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
```

Add to `ReferralRecordOut`:

```python
    status__mapping: str

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_mapping(ReferralRecordStatus, obj.status)
```

Add to `ReferralRuleConfigOut`:

```python
    trigger_event__mapping: str
    display_level__mapping: str

    @staticmethod
    def resolve_trigger_event__mapping(obj):
        return enum_mapping(ReferralTriggerEvent, obj.trigger_event)

    @staticmethod
    def resolve_display_level__mapping(obj):
        return enum_mapping(ReferralDisplayLevel, obj.display_level)
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
docker compose exec web pytest tests/wallet/test_api.py tests/notifications/test_dispatches_api.py tests/referrals/test_api.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/wallet/schemas.py apps/notifications/schemas.py apps/referrals/schemas.py tests/wallet/test_api.py tests/notifications/test_dispatches_api.py tests/referrals/test_api.py
git commit -m "feat: 增加运营枚举映射"
```

---

### Task 5: Frontend enum metadata service

**Files:**
- Create: `frontend_admin/src/services/manual/enums.ts`
- Test: add focused assertions in page tests that use the service mocks.

- [ ] **Step 1: Create manual enum service**

Create `frontend_admin/src/services/manual/enums.ts`:

```ts
import {request} from '@umijs/max';
import {useQuery} from '@tanstack/react-query';

export type EnumOption = {
  value: string;
  mapping: string;
};

export type EnumMap = Record<string, EnumOption[]>;

export function listEnums(keys: string[]) {
  return request<EnumMap>('/api/enums/', {
    method: 'GET',
    params: keys.length ? {keys: keys.join(',')} : undefined,
  });
}

export function useEnums(keys: string[]) {
  return useQuery({
    queryKey: ['enums', keys],
    queryFn: () => listEnums(keys),
    staleTime: 10 * 60 * 1000,
  });
}

export function enumSelectOptions(enumMap: EnumMap | undefined, key: string) {
  return (enumMap?.[key] || []).map((item) => ({
    value: item.value,
    label: item.mapping,
  }));
}

export function enumMapping(value: string | undefined | null, mapping: string | undefined | null) {
  return mapping || value || '-';
}
```

- [ ] **Step 2: Run TypeScript for the new service**

Run:

```bash
source "$HOME/.nvm/nvm.sh"; nvm use 22; npm --prefix frontend_admin run tsc -- --noEmit
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend_admin/src/services/manual/enums.ts
git commit -m "feat: 增加前端枚举服务"
```

---

### Task 6: Replace platform user and real-name enum hardcoding

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/users/index.tsx`
- Modify: `frontend_admin/src/pages/platform-management/users/index.test.tsx`
- Modify: `frontend_admin/src/pages/platform-management/real-name/index.tsx`
- Modify: `frontend_admin/src/pages/platform-management/real-name/index.test.tsx`

- [ ] **Step 1: Update tests to mock enum service**

In `users/index.test.tsx`, mock:

```ts
vi.mock('@/services/manual/enums', () => ({
  enumMapping: (value?: string, mapping?: string) => mapping || value || '-',
  enumSelectOptions: () => [
    {value: 'unverified', label: '未实名'},
    {value: 'verified', label: '已实名'},
  ],
  useEnums: () => ({data: {'accounts.real_name_status': [{value: 'unverified', mapping: '未实名'}, {value: 'verified', mapping: '已实名'}]}}),
}));
```

Add `real_name_status__mapping` to mocked users:

```ts
real_name_status: 'pending',
real_name_status__mapping: '待校验',
```

Assert the rendered row shows `实名状态 待校验` instead of the raw value.

- [ ] **Step 2: Replace hardcoded status options**

In `users/index.tsx`, remove `realNameStatusOptions` and add:

```ts
import {enumMapping, enumSelectOptions, useEnums} from '@/services/manual/enums';
```

Inside component:

```ts
const enumsQuery = useEnums(['accounts.real_name_status']);
const realNameStatusOptions = enumSelectOptions(enumsQuery.data, 'accounts.real_name_status');
```

Change row display:

```tsx
<Typography.Text type="secondary">{`实名状态 ${enumMapping(record.real_name_status, record.real_name_status__mapping)}`}</Typography.Text>
```

- [ ] **Step 3: Update real-name page display**

In `real-name/index.tsx`, use `status__mapping/source__mapping/provider__mapping` when present:

```tsx
<Tag color={record.stage_color}>{record.status__mapping || record.status_label}</Tag>
```

Keep existing `statusOptions` only until this page uses `/api/enums/` for the status filter:

```ts
const enumsQuery = useEnums(['accounts.real_name_status']);
const statusOptions = enumSelectOptions(enumsQuery.data, 'accounts.real_name_status');
```

- [ ] **Step 4: Run TypeScript**

Run:

```bash
source "$HOME/.nvm/nvm.sh"; nvm use 22; npm --prefix frontend_admin run tsc -- --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run focused tests if Vitest environment is fixed**

Run:

```bash
source "$HOME/.nvm/nvm.sh"; nvm use 22; npm --prefix frontend_admin exec -- vitest run src/pages/platform-management/users/index.test.tsx src/pages/platform-management/real-name/index.test.tsx
```

Expected: PASS. If the known Vite/Vitest `./module-runner` export error appears, record that startup error in the final implementation notes.

- [ ] **Step 6: Commit**

```bash
git add frontend_admin/src/pages/platform-management/users/index.tsx frontend_admin/src/pages/platform-management/users/index.test.tsx frontend_admin/src/pages/platform-management/real-name/index.tsx frontend_admin/src/pages/platform-management/real-name/index.test.tsx
git commit -m "refactor: 使用后端实名枚举映射"
```

---

### Task 7: Replace property rental enum options and displays

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`
- Modify rental pages and tests listed in File Structure.

- [ ] **Step 1: Keep enum values, remove label source from constants**

In `constants.ts`, keep value constants and color/transition helpers, but stop exporting backend-owned option arrays for these:

```ts
// Keep:
export const HOUSE_STATUS = { VACANT: 'vacant', RENTED: 'rented', RENOVATING: 'renovating', LOCKED: 'locked' } as const;
export const HOUSE_PUBLISH_STATUS = { DRAFT: 'draft', PUBLISHED: 'published', UNPUBLISHED: 'unpublished' } as const;
export const VIEWING_STATUS = { SCHEDULED: 'scheduled', VIEWED: 'viewed', CANCELED: 'canceled', NO_SHOW: 'no_show', CONVERTED: 'converted' } as const;
export const LEASE_STATUS = { PENDING: 'pending', ACTIVE: 'active', EXPIRED: 'expired', TERMINATED: 'terminated' } as const;

// Keep local UI-only:
export const HOUSE_PUBLISH_STATUS_COLOR: Record<string, string> = { draft: 'default', published: 'green', unpublished: 'orange' };
export const STATUS_COLOR: Record<string, string> = { vacant: 'green', rented: 'blue', renovating: 'orange', locked: 'red', active: 'blue', converted: 'purple' };
```

- [ ] **Step 2: Use enum options in estate/house forms and filters**

In estate page:

```ts
const enumsQuery = useEnums(['house.estate_property_type']);
const propertyTypeOptions = enumSelectOptions(enumsQuery.data, 'house.estate_property_type');
```

Use:

```tsx
<Select options={propertyTypeOptions} />
```

Display:

```tsx
record.property_type__mapping || record.property_type
```

In houses page:

```ts
const enumsQuery = useEnums(['house.house_status', 'house.house_publish_status']);
const houseStatusOptions = enumSelectOptions(enumsQuery.data, 'house.house_status');
const publishStatusOptions = enumSelectOptions(enumsQuery.data, 'house.house_publish_status');
```

Use `record.status__mapping` and `record.publish_status__mapping` in tags.

- [ ] **Step 3: Use enum options in house detail/new**

In house detail/new pages:

```ts
const enumsQuery = useEnums(['house.house_orientation', 'house.house_decoration']);
const orientationOptions = enumSelectOptions(enumsQuery.data, 'house.house_orientation');
const decorationOptions = enumSelectOptions(enumsQuery.data, 'house.house_decoration');
```

Use:

```tsx
<Select allowClear options={orientationOptions} />
<Select allowClear options={decorationOptions} />
```

- [ ] **Step 4: Use enum options in viewings and leases**

Viewings:

```ts
const enumsQuery = useEnums(['house.viewing_record_status']);
const viewingStatusOptions = enumSelectOptions(enumsQuery.data, 'house.viewing_record_status');
```

Leases:

```ts
const enumsQuery = useEnums(['house.lease_status']);
const leaseStatusOptions = enumSelectOptions(enumsQuery.data, 'house.lease_status');
```

For flow buttons, keep transition keys in frontend but label with enum map:

```ts
const leaseStatusLabel = (status: string) => enumSelectOptions(enumsQuery.data, 'house.lease_status').find((item) => item.value === status)?.label || status;
```

- [ ] **Step 5: Run TypeScript**

Run:

```bash
source "$HOME/.nvm/nvm.sh"; nvm use 22; npm --prefix frontend_admin run tsc -- --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend_admin/src/pages/property-rental
git commit -m "refactor: 使用后端房源枚举映射"
```

---

### Task 8: Replace wallet, notifications, and referrals enum displays

**Files:**
- Modify wallet, notification, referral pages and tests listed in File Structure.

- [ ] **Step 1: Replace wallet hardcoded labels**

In wallet pages, prefer API mapping:

```ts
const statusLabel = withdrawal.status__mapping || withdrawal.status;
const payChannelLabel = withdrawal.pay_channel__mapping || withdrawal.pay_channel;
```

For filters:

```ts
const enumsQuery = useEnums(['wallet.withdrawal_status']);
const withdrawalStatusOptions = enumSelectOptions(enumsQuery.data, 'wallet.withdrawal_status');
```

- [ ] **Step 2: Replace notification dispatch labels**

In notification dispatch page:

```ts
const dispatchStatus = record.status__mapping || record.status;
const dispatchScope = record.scope__mapping || record.scope;
```

For filters:

```ts
const enumsQuery = useEnums(['notifications.dispatch_status', 'notifications.dispatch_scope']);
```

- [ ] **Step 3: Replace referral labels**

In referral page:

```ts
const recordStatus = record.status__mapping || record.status;
const triggerEvent = config.trigger_event__mapping || config.trigger_event;
const displayLevel = config.display_level__mapping || config.display_level;
```

For filters:

```ts
const enumsQuery = useEnums(['referrals.record_status']);
```

- [ ] **Step 4: Update tests with mapping fields**

In each page test fixture, include mapping fields:

```ts
status: 'pending_review',
status__mapping: '待审核',
pay_channel: 'wechat',
pay_channel__mapping: '微信提现',
```

Assert visible labels come from `__mapping`, not frontend hardcoded maps.

- [ ] **Step 5: Run TypeScript**

Run:

```bash
source "$HOME/.nvm/nvm.sh"; nvm use 22; npm --prefix frontend_admin run tsc -- --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend_admin/src/pages/wallet-management frontend_admin/src/pages/personal-business/overview frontend_admin/src/pages/platform-management/notifications frontend_admin/src/pages/platform-management/notification-dispatches frontend_admin/src/pages/platform-management/referrals
git commit -m "refactor: 使用后端运营枚举映射"
```

---

### Task 9: Final verification and audit

**Files:**
- No new source files unless verification finds a missed reference.

- [ ] **Step 1: Audit hardcoded backend enum labels**

Run:

```bash
rg "未实名|待校验|已实名|已驳回|人工复核|已撤销|空置|已租|装修中|封存|草稿|已发布|已下架|待审核|打款中|已打款|已预约|已带看|已成交" frontend_admin/src/pages frontend_admin/src/services/manual
```

Expected: remaining matches are UI task labels, tests, color comments, or mapping fixtures only.

- [ ] **Step 2: Run backend tests**

Run:

```bash
docker compose exec web pytest tests/base/test_enum_registry_api.py tests/accounts/test_admin_user_lifecycle_api.py tests/accounts/test_real_name_api.py tests/house/test_api.py tests/wallet/test_api.py tests/notifications/test_dispatches_api.py tests/referrals/test_api.py -q
```

Expected: PASS.

- [ ] **Step 3: Run frontend TypeScript**

Run:

```bash
source "$HOME/.nvm/nvm.sh"; nvm use 22; npm --prefix frontend_admin run tsc -- --noEmit
```

Expected: PASS.

- [ ] **Step 4: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Commit any verification fixes**

If verification required a small fix:

```bash
git add <fixed-files>
git commit -m "fix: 补齐枚举映射使用"
```

If no fixes were required, do not create an empty commit.

## Self-Review

- Spec coverage: row `__mapping` fields are handled by Tasks 2-4; `/api/enums/` is Task 1; frontend filters and display replacement are Tasks 5-8; pagination shape stays unchanged because `/api/enums/` is a separate endpoint.
- Placeholder scan: no incomplete-marker placeholders are present.
- Type consistency: backend uses `<field>__mapping`; enum metadata uses `{ value, mapping }`; frontend converts to Ant Design `{ value, label }` only at Select boundary.
