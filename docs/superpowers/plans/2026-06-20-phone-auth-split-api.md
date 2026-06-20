# Phone Auth Split API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让项目自有账户 API 统一接收拆分后的手机号字段，同时继续复用 allauth 现有完整手机号认证流程。

**Architecture:** 在 `apps.accounts.api` 增加一层薄包装接口，负责把 `phone_country_code` 与 `phone_national_number` 组合成完整手机号，再转发给 `/api/allauth/...` 现有端点。前端改用手写 manual service 调这些包装接口，不再直接在页面里拼接手机号后调用 allauth 生成客户端。

**Tech Stack:** Django 5, django-ninja, django-allauth headless, pytest, React/Umi request

---

### Task 1: 后端包装接口测试

**Files:**
- Modify: `tests/accounts/test_phone_signup_flow.py`
- Modify: `tests/accounts/test_manage_phone_change_flow.py`
- Modify: `tests/accounts/test_login_by_code.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_split_signup_wrapper_triggers_phone_verification(client):
    ...

def test_split_phone_change_wrapper_updates_current_user(signed_in_client):
    ...

def test_split_code_request_wrapper_triggers_sms(client, phone_user):
    ...
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec web pytest tests/accounts/test_phone_signup_flow.py tests/accounts/test_manage_phone_change_flow.py tests/accounts/test_login_by_code.py -q`
Expected: FAIL because wrapper endpoints do not exist yet.

- [ ] **Step 3: Write minimal implementation for request wrappers**

```python
@users_router.post("/auth/browser/signup/")
def signup_with_split_phone(...):
    phone = compose_phone(...)
    return _proxy_allauth(...)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec web pytest tests/accounts/test_phone_signup_flow.py tests/accounts/test_manage_phone_change_flow.py tests/accounts/test_login_by_code.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/accounts/test_phone_signup_flow.py tests/accounts/test_manage_phone_change_flow.py tests/accounts/test_login_by_code.py apps/accounts/api.py apps/accounts/schemas.py
git commit -m "账户认证包装接口支持拆分手机号"
```

### Task 2: 前端账户服务改用包装接口

**Files:**
- Create: `frontend_admin/src/services/manual/phoneAuth.ts`
- Modify: `frontend_admin/src/pages/account/settings/service.ts`
- Modify: `frontend_admin/src/pages/account/settings/service.test.ts`

- [ ] **Step 1: Write the failing frontend service tests**

```ts
it('calls split-phone change endpoint', async () => {
  ...
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/service.test.ts`
Expected: FAIL because the service still calls allauth endpoints directly.

- [ ] **Step 3: Write minimal frontend service implementation**

```ts
export async function postBrowserPhoneChangeWithSplit(...) {
  return request('/api/users/auth/browser/account/phone/', ...)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend_admin/src/services/manual/phoneAuth.ts frontend_admin/src/pages/account/settings/service.ts frontend_admin/src/pages/account/settings/service.test.ts
git commit -m "账户设置改用拆分手机号认证接口"
```

### Task 3: 全量验证

**Files:**
- No code changes

- [ ] **Step 1: Run targeted backend tests**

Run: `docker compose exec web pytest tests/accounts/test_phone_signup_flow.py tests/accounts/test_manage_phone_change_flow.py tests/accounts/test_login_by_code.py -q`
Expected: PASS

- [ ] **Step 2: Run targeted frontend tests**

Run: `cd frontend_admin && nvm use 22 && pnpm vitest run src/pages/account/settings/service.test.ts src/pages/account/settings/components/security.modals.test.tsx`
Expected: PASS

- [ ] **Step 3: Review changed API contract**

Confirm new wrapper endpoints receive split phone fields, and internal allauth adapter still only receives composed full phone strings.
