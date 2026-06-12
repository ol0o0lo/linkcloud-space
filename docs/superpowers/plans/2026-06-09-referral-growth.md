# Referral Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建独立的用户邀请注册裂变模块，完成邀请归因、实名认证达标、后台人工审核、钱包发奖，以及前后台基础 UI 闭环。

**Architecture:** 新增 `apps/referrals/` 作为独立业务域，负责邀请入口、注册归因、资格达成、审核状态与奖励发放触发；`wallet` 只负责记账入账。为了让一期真正可交付，本计划把首个“关键行为”固定为现有代码中已具备的 `实名认证通过`，并通过注册页 query + session 捕获邀请码，再在账号注册完成后生成邀请记录。

**Tech Stack:** Django 5, django-ninja, django-allauth, pytest, model-bakery, Vue 3 SPA, Vite 8, Vue Router 5, Vben Admin, Antdv Next

**Implemented Notes:** 一期已按“实名认证通过”作为达标事件完成后端闭环、用户侧推广中心和后台审核页；`frontend_admin` 类型检查受本机 Node/corepack 环境影响未能跑通。

---

## File Map

- Create: `apps/referrals/__init__.py`
- Create: `apps/referrals/apps.py`
- Create: `apps/referrals/constants.py`
- Create: `apps/referrals/middleware.py`
- Create: `apps/referrals/models.py`
- Create: `apps/referrals/schemas.py`
- Create: `apps/referrals/services.py`
- Create: `apps/referrals/api.py`
- Create: `apps/referrals/migrations/0001_initial.py`
- Create: `tests/referrals/test_models.py`
- Create: `tests/referrals/test_services.py`
- Create: `tests/referrals/test_api.py`
- Create: `frontend/js/views/account/ReferralCenterView.vue`
- Create: `frontend_admin/apps/web-antdv-next/src/api/django/referrals.ts`
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/referrals.vue`
- Modify: `config/settings/_base.py`
- Modify: `config/api.py`
- Modify: `apps/accounts/real_name.py`
- Modify: `frontend/js/router.js`
- Modify: `frontend/js/layouts/AccountLayout.vue`
- Modify: `frontend/js/accounts/views/SignupView.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts`

## Task 1: 搭建 referrals 模块骨架与数据模型

**Files:**
- Create: `apps/referrals/__init__.py`
- Create: `apps/referrals/apps.py`
- Create: `apps/referrals/constants.py`
- Create: `apps/referrals/models.py`
- Create: `apps/referrals/migrations/0001_initial.py`
- Create: `tests/referrals/test_models.py`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 先写失败的模型测试**

```python
from django.db import IntegrityError
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.models import ReferralLink, ReferralRecord, ReferralRuleConfig


class ReferralModelTests(TestCase):
    def test_rule_config_is_singleton_like(self):
        ReferralRuleConfig.objects.create(name='default')
        with self.assertRaises(IntegrityError):
            ReferralRuleConfig.objects.create(name='another')

    def test_referral_link_belongs_to_single_inviter(self):
        inviter = baker.make(User)
        link = ReferralLink.objects.create(inviter=inviter, code='ABC123')
        self.assertEqual(link.inviter_id, inviter.id)

    def test_same_invitee_cannot_have_two_effective_records(self):
        inviter = baker.make(User)
        invitee = baker.make(User)
        link = baker.make(ReferralLink, inviter=inviter)
        ReferralRecord.objects.create(inviter=inviter, invitee=invitee, referral_link=link, status='registered')
        with self.assertRaises(IntegrityError):
            ReferralRecord.objects.create(inviter=inviter, invitee=invitee, referral_link=link, status='registered')
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `docker compose exec web pytest tests/referrals/test_models.py -v`
Expected: FAIL，提示 `ModuleNotFoundError: No module named 'apps.referrals'`

- [ ] **Step 3: 实现最小模型骨架与 app 注册**

```python
# apps/referrals/apps.py
from django.apps import AppConfig


class ReferralsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.referrals'
    verbose_name = '裂变推广'
```

```python
# apps/referrals/models.py
from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin


class ReferralRuleConfig(CreateUpdateTimeModelMixin):
    name = models.CharField(max_length=50, default='default', unique=True)
    trigger_event = models.CharField(max_length=50, default='real_name_verified')
    inviter_reward_amount = models.BigIntegerField(default=0)
    invitee_reward_amount = models.BigIntegerField(default=0)
    requires_manual_review = models.BooleanField(default=True)
    allow_link = models.BooleanField(default=True)
    allow_code = models.BooleanField(default=True)
    display_level = models.CharField(max_length=20, default='masked_progress')


class ReferralLink(CreateUpdateTimeModelMixin):
    inviter = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referral_link')
    code = models.CharField(max_length=32, unique=True)
    is_active = models.BooleanField(default=True)


class ReferralRecord(CreateUpdateTimeModelMixin):
    inviter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_referral_records')
    invitee = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_referral_record')
    referral_link = models.ForeignKey(ReferralLink, on_delete=models.PROTECT, related_name='records')
    status = models.CharField(max_length=32, default='registered')


class ReferralRewardReview(CreateUpdateTimeModelMixin):
    referral_record = models.ForeignKey(ReferralRecord, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    action = models.CharField(max_length=20)
    remark = models.CharField(max_length=255, blank=True, default='')
```

```python
# config/settings/_base.py
INSTALLED_APPS = [
    'apps.teams',
    'apps.access',
    'apps.wallet',
    'apps.referrals',
    'apps.notifications',
    'apps.settings',
]
```

- [ ] **Step 4: 生成迁移并让模型测试通过**

Run: `docker compose exec web python manage.py makemigrations referrals`
Expected: 生成 `apps/referrals/migrations/0001_initial.py`

Run: `docker compose exec web pytest tests/referrals/test_models.py -v`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add apps/referrals config/settings/_base.py tests/referrals/test_models.py
git commit -m "feat: 新增裂变推广基础模型"
```

## Task 2: 实现邀请码捕获、注册归因与服务层核心逻辑

**Files:**
- Create: `apps/referrals/middleware.py`
- Create: `apps/referrals/services.py`
- Create: `tests/referrals/test_services.py`
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 先写失败的服务测试**

```python
from django.test import RequestFactory, TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.services import capture_referral_code, create_record_for_registered_user


class ReferralServiceTests(TestCase):
    def test_capture_referral_code_writes_session(self):
        request = RequestFactory().get('/accounts/signup/?invite_code=ABC123')
        request.session = {}
        capture_referral_code(request)
        self.assertEqual(request.session['referral_invite_code'], 'ABC123')

    def test_create_record_for_registered_user_uses_session_code(self):
        inviter = baker.make(User)
        invitee = baker.make(User)
        inviter.referral_link.code = 'INV123'
        inviter.referral_link.save(update_fields=['code'])

        record = create_record_for_registered_user(invitee=invitee, invite_code='INV123')

        self.assertEqual(record.inviter_id, inviter.id)
        self.assertEqual(record.invitee_id, invitee.id)
        self.assertEqual(record.status, 'registered')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `docker compose exec web pytest tests/referrals/test_services.py -v`
Expected: FAIL，提示 `cannot import name 'capture_referral_code'`

- [ ] **Step 3: 实现邀请码捕获与注册归因服务**

```python
# apps/referrals/middleware.py
from apps.referrals.services import capture_referral_code


class ReferralAttributionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        capture_referral_code(request)
        return self.get_response(request)
```

```python
# apps/referrals/services.py
from django.db import transaction

from apps.referrals.models import ReferralLink, ReferralRecord


def capture_referral_code(request):
    if request.method != 'GET':
        return
    invite_code = (request.GET.get('invite_code') or '').strip()
    if invite_code:
        request.session['referral_invite_code'] = invite_code


@transaction.atomic
def create_record_for_registered_user(*, invitee, invite_code: str):
    if not invite_code:
        return None
    if ReferralRecord.objects.filter(invitee=invitee).exists():
        return ReferralRecord.objects.get(invitee=invitee)
    link = ReferralLink.objects.select_related('inviter').get(code=invite_code, is_active=True)
    return ReferralRecord.objects.create(
        inviter=link.inviter,
        invitee=invitee,
        referral_link=link,
        status='registered',
    )
```

```python
# config/settings/_base.py
MIDDLEWARE = [
    'allauth.account.middleware.AccountMiddleware',
    'django_alive.middleware.healthcheck_bypass_host_check',
    'django.middleware.security.SecurityMiddleware',
    'apps.organizations.middleware.OrganizationMiddleware',
    'apps.referrals.middleware.ReferralAttributionMiddleware',
    'apps.accounts.middleware.TimezoneMiddleware',
]
```

- [ ] **Step 4: 给每个用户自动补 ReferralLink，并回归服务测试**

```python
# apps/referrals/services.py
import secrets

from apps.referrals.models import ReferralLink


def ensure_referral_link(user):
    link, _created = ReferralLink.objects.get_or_create(
        inviter=user,
        defaults={'code': secrets.token_urlsafe(6).replace('-', '').replace('_', '')[:10].upper()},
    )
    return link
```

Run: `docker compose exec web pytest tests/referrals/test_models.py tests/referrals/test_services.py -v`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add apps/referrals config/settings/_base.py tests/referrals/test_services.py
git commit -m "feat: 支持裂变邀请码捕获与注册归因"
```

## Task 3: 把实名认证通过接成一期达标事件，并接入钱包发奖服务

**Files:**
- Create: `tests/referrals/test_services.py`
- Modify: `apps/referrals/services.py`
- Modify: `apps/accounts/real_name.py`

- [ ] **Step 1: 为达标和发奖写失败测试**

```python
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.referrals.services import approve_referral_reward, mark_referral_as_qualified
from apps.wallet.models import WalletLedger


class ReferralRewardFlowTests(TestCase):
    def test_real_name_verified_marks_record_qualified(self):
        record = baker.make('referrals.ReferralRecord', status='registered')
        mark_referral_as_qualified(invitee=record.invitee, event_type='real_name_verified')
        record.refresh_from_db()
        self.assertEqual(record.status, 'pending_review')

    def test_approve_reward_issues_wallet_credit(self):
        record = baker.make('referrals.ReferralRecord', status='pending_review')
        reviewer = baker.make(User, is_superuser=True)
        approve_referral_reward(record=record, reviewer=reviewer, remark='ok')
        record.refresh_from_db()
        self.assertEqual(record.status, 'reward_issued')
        self.assertTrue(WalletLedger.objects.filter(biz_type='referral.reward', biz_id=str(record.pk)).exists())
```

- [ ] **Step 2: 运行测试确认失败**

Run: `docker compose exec web pytest tests/referrals/test_services.py -v`
Expected: FAIL，提示 `mark_referral_as_qualified` / `approve_referral_reward` 未定义

- [ ] **Step 3: 实现达标与审核发奖服务**

```python
# apps/referrals/services.py
from apps.wallet.constants import WalletEntryType
from apps.wallet.services import apply_wallet_credit


def mark_referral_as_qualified(*, invitee, event_type: str):
    record = ReferralRecord.objects.select_for_update().select_related('inviter').filter(invitee=invitee).first()
    if record is None or record.status not in {'registered'}:
        return None
    if event_type != 'real_name_verified':
        return None
    record.status = 'pending_review'
    record.save(update_fields=['status', 'updated_at'])
    return record


def approve_referral_reward(*, record, reviewer, remark: str):
    rule = ReferralRuleConfig.objects.get()
    review = record.reviews.create(reviewer=reviewer, action='approve', remark=remark)
    apply_wallet_credit(
        user=record.inviter,
        amount=rule.inviter_reward_amount,
        entry_type=WalletEntryType.PROMOTION_REWARD,
        biz_type='referral.reward',
        biz_id=str(record.pk),
        idempotency_key=f'referral-reward:{record.pk}',
        operator=reviewer,
        remark=remark,
    )
    record.status = 'reward_issued'
    record.save(update_fields=['status', 'updated_at'])
    return review
```

- [ ] **Step 4: 在实名认证汇总同步点触发达标逻辑**

```python
# apps/accounts/real_name.py
from apps.accounts.constants import RealNameStatus
from apps.referrals.services import mark_referral_as_qualified


def sync_user_real_name_summary(user, verification: RealNameVerification) -> None:
    user.real_name_status = verification.status
    user.real_name_masked = verification.real_name_masked
    user.id_number_masked = verification.id_number_masked
    user.real_name_verified_at = verification.reviewed_at if verification.status == RealNameStatus.VERIFIED else None
    user.save(update_fields=['real_name_status', 'real_name_masked', 'id_number_masked', 'real_name_verified_at'])
    if verification.status == RealNameStatus.VERIFIED:
        mark_referral_as_qualified(invitee=user, event_type='real_name_verified')
```

Run: `docker compose exec web pytest tests/referrals/test_services.py tests/accounts/test_real_name_api.py -v`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add apps/referrals/services.py apps/accounts/real_name.py tests/referrals/test_services.py
git commit -m "feat: 接入实名达标与裂变钱包发奖"
```

## Task 4: 实现 11 个 referral API 与后端测试

**Files:**
- Create: `apps/referrals/schemas.py`
- Create: `apps/referrals/api.py`
- Create: `tests/referrals/test_api.py`
- Modify: `config/api.py`

- [ ] **Step 1: 先写 API 失败测试，覆盖用户侧/后台侧/内部侧主路径**

```python
import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User


class ReferralAPITests(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.admin = baker.make(User, is_superuser=True, is_staff=True)

    def test_user_can_get_referral_summary(self):
        self.client.force_login(self.user)
        resp = self.client.get('/api/referrals/me/summary/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_can_review_referral_record(self):
        record = baker.make('referrals.ReferralRecord', status='pending_review')
        self.client.force_login(self.admin)
        resp = self.client.post(
            f'/api/admin/referrals/records/{record.pk}/review/',
            data=json.dumps({'approved': True, 'remark': 'ok'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)

```

- [ ] **Step 2: 运行测试确认失败**

Run: `docker compose exec web pytest tests/referrals/test_api.py -v`
Expected: FAIL，提示 `/api/referrals/me/summary/` 路由不存在

- [ ] **Step 3: 实现 schemas、routers 和 6 个对外接口**

```python
# apps/referrals/api.py
from django.shortcuts import get_object_or_404

from ninja import Router
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_superuser
from apps.referrals.models import ReferralRecord
from apps.referrals.services import approve_referral_reward, ensure_referral_link

router = Router(tags=['裂变/用户'])
admin_router = Router(tags=['裂变/管理'])


@router.get('/me/summary/')
def referral_summary(request):
    require_authenticated(request)
    link = ensure_referral_link(request.user)
    qs = ReferralRecord.objects.filter(inviter=request.user)
    return {
        'invite_code': link.code,
        'share_link': f'/accounts/signup/?invite_code={link.code}',
        'registered_count': qs.filter(status='registered').count(),
        'pending_review_count': qs.filter(status='pending_review').count(),
        'rewarded_count': qs.filter(status='reward_issued').count(),
    }


@admin_router.post('/records/{record_id}/review/')
def review_referral_record(request, record_id: int, payload):
    require_superuser(request)
    record = get_object_or_404(ReferralRecord, pk=record_id)
    if payload.approved:
        approve_referral_reward(record=record, reviewer=request.user, remark=payload.remark)
    else:
        record.reviews.create(reviewer=request.user, action='reject', remark=payload.remark)
        record.status = 'review_rejected'
        record.save(update_fields=['status', 'updated_at'])
    return record


```

```python
# config/api.py
from apps.referrals.api import admin_router as referrals_admin_router
from apps.referrals.api import router as referrals_router

api.add_router('/referrals/', referrals_router)
api.add_router('/admin/referrals/', referrals_admin_router)
```

- [ ] **Step 4: 回归 referral API 与钱包联动测试**

Run: `docker compose exec web pytest tests/referrals/test_api.py tests/wallet/test_api.py -v`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add apps/referrals/api.py apps/referrals/schemas.py config/api.py tests/referrals/test_api.py
git commit -m "feat: 新增裂变推广接口"
```

## Task 5: 落地用户侧推广中心与注册页邀请感知

**Files:**
- Create: `frontend/js/views/account/ReferralCenterView.vue`
- Modify: `frontend/js/router.js`
- Modify: `frontend/js/layouts/AccountLayout.vue`
- Modify: `frontend/js/accounts/views/SignupView.vue`

- [ ] **Step 1: 先补前台入口与最小交互草稿**

```js
// frontend/js/router.js
{
  path: '/accounts/referrals/',
  name: 'account-referrals',
  component: () => import('./views/account/ReferralCenterView.vue'),
  meta: { requiresAuth: true },
}
```

```js
// frontend/js/layouts/AccountLayout.vue
{ to: { name: 'account-referrals' }, label: 'Referrals', activeNames: ['account-referrals'] },
```

- [ ] **Step 2: 运行前端 lint，确认新增页面尚未实现时失败或报引用问题**

Run: `bun run lint-js`
Expected: FAIL 或报 `ReferralCenterView.vue` 缺失/引用错误

- [ ] **Step 3: 实现推广中心页面与注册页邀请码提示**

```vue
<!-- frontend/js/views/account/ReferralCenterView.vue -->
<script setup>
import { onMounted, ref } from 'vue';
import { get } from '@/utils/api';

const summary = ref(null);
const records = ref([]);

onMounted(async () => {
  summary.value = await get('/api/referrals/me/summary/');
  const data = await get('/api/referrals/me/records/');
  records.value = data.items || data;
});
</script>
```

```vue
<!-- frontend/js/accounts/views/SignupView.vue -->
<p v-if="route.query.invite_code" class="mt-2 text-center text-sm text-emerald-600">
  已通过邀请码 {{ route.query.invite_code }} 进入注册流程
</p>
```

- [ ] **Step 4: 验证 SPA 构建通过**

Run: `bun run build`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add frontend/js/router.js frontend/js/layouts/AccountLayout.vue frontend/js/accounts/views/SignupView.vue frontend/js/views/account/ReferralCenterView.vue
git commit -m "feat: 增加用户侧推广中心页面"
```

## Task 6: 落地后台裂变配置与审核页面

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/api/django/referrals.ts`
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/referrals.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts`

- [ ] **Step 1: 先把后台菜单与 API client 草图写出来**

```ts
// frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts
{
  component: () => import('#/views/admin/referrals.vue'),
  meta: {
    authority: ['admin', 'super'],
    icon: 'lucide:gift',
    title: '裂变推广',
  },
  name: 'AdminReferrals',
  path: '/admin/referrals',
}
```

```ts
// frontend_admin/apps/web-antdv-next/src/api/django/referrals.ts
import { requestClient } from '#/api/request';

export async function getReferralConfigApi() {
  return requestClient.get('/api/admin/referrals/config/');
}

export async function listReferralRecordsApi(params = {}) {
  return requestClient.get('/api/admin/referrals/records/', { params });
}
```

- [ ] **Step 2: 运行后台类型检查，确认当前缺页或 API 未实现的报错**

Run: `cd frontend_admin/apps/web-antdv-next && pnpm typecheck`
Expected: FAIL 或出现 `Cannot find module '#/views/admin/referrals.vue'`

- [ ] **Step 3: 实现后台裂变页，包含配置区与待审列表**

```vue
<!-- frontend_admin/apps/web-antdv-next/src/views/admin/referrals.vue -->
<script lang="ts" setup>
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Button, Card, Input, message, Table } from 'antdv-next';

import { getReferralConfigApi, listReferralRecordsApi, reviewReferralRecordApi, updateReferralConfigApi } from '#/api/django/referrals';

const config = ref(null);
const records = ref([]);

onMounted(async () => {
  config.value = await getReferralConfigApi();
  records.value = (await listReferralRecordsApi()).items ?? [];
});
</script>
```

- [ ] **Step 4: 验证后台类型检查与构建**

Run: `cd frontend_admin/apps/web-antdv-next && pnpm typecheck`
Expected: PASS

Run: `just build_admin`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts frontend_admin/apps/web-antdv-next/src/api/django/referrals.ts frontend_admin/apps/web-antdv-next/src/views/admin/referrals.vue
git commit -m "feat: 增加后台裂变推广页面"
```

## Task 7: 全链路回归、文档更新与交付检查

**Files:**
- Modify: `docs/superpowers/specs/2026-06-09-referral-growth-design.md`
- Modify: `docs/superpowers/plans/2026-06-09-referral-growth.md`

- [ ] **Step 1: 跑完整后端回归，确认裂变、实名、钱包一起工作**

Run: `docker compose exec web pytest tests/referrals tests/accounts/test_real_name_api.py tests/wallet -v`
Expected: PASS

- [ ] **Step 2: 跑前后台构建，确认 UI 不破坏现有产物**

Run: `bun run build`
Expected: PASS

Run: `just build_admin`
Expected: PASS

- [ ] **Step 3: 手工验收闭环**

```text
1. 访问 /accounts/signup/?invite_code=<code>，确认页面显示邀请码提示。
2. 注册新账号后，在数据库或 API 中能看到 registered 状态的 ReferralRecord。
3. 提交并通过实名认证后，ReferralRecord 进入 pending_review。
4. 后台 /admin/referrals 审核通过后，邀请人钱包出现 referral.reward 流水。
5. 用户侧 /accounts/referrals/ 能看到邀请记录与奖励结果。
```

- [ ] **Step 4: 更新 spec/plan 中的已实现说明**

```md
- 一期关键行为已落地为：实名认证通过（`real_name_verified`）
- 奖励发放通过 `apps.wallet.services.apply_wallet_credit()` 完成
- 前台入口：`/accounts/referrals/`
- 后台入口：`/admin/referrals`
```

- [ ] **Step 5: 提交最终交付**

```bash
git add docs/superpowers/specs/2026-06-09-referral-growth-design.md docs/superpowers/plans/2026-06-09-referral-growth.md
git commit -m "docs: 更新裂变推广实现说明"
```
