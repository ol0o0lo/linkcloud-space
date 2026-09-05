# Frontend Admin Flow Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成管理端六类已确认断点，使入口、业务动作、状态回看和权限控制形成真实闭环。

**Architecture:** 认证继续使用 allauth headless；现有后端已有的能力由管理端直接接入，真正缺失的裂变规则执行、分享生命周期和导航能力通过小型 Ninja API 补齐。生成客户端不手改，新接口使用手写适配器。

**Tech Stack:** Django 5、django-ninja、django-allauth headless、React 19、Umi Max、React Query、Ant Design 6、Vitest、pytest。

---

### Task 1: 认证路由与真实注册

**Files:**
- Modify: `config/settings/_base.py`
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/utils/adminRouting.ts`
- Create: `frontend_admin/src/services/manual/publicAuth.ts`
- Replace: `frontend_admin/src/pages/user/register/index.tsx`
- Create: `frontend_admin/src/pages/user/verify-phone/index.tsx`
- Create: `frontend_admin/src/pages/user/password-reset/index.tsx`
- Create: `frontend_admin/src/pages/user/password-reset/confirm.tsx`
- Create: `frontend_admin/src/pages/user/confirm-email/index.tsx`
- Create: `frontend_admin/src/pages/user/social-error/index.tsx`
- Test: `frontend_admin/src/pages/user/public-auth-flow.test.tsx`
- Test: `frontend_admin/src/routes.test.ts`

- [ ] 写失败测试：注册提交 allauth payload，401 `verify_phone` 跳转验证页，忘记密码和邮件 key 页面调用对应 API。
- [ ] 运行 `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/user/public-auth-flow.test.tsx src/routes.test.ts`，确认因页面/路由缺失失败。
- [ ] 实现公共认证适配器和页面，更新 allauth 前端 URL 与 SPA URL。
- [ ] 重跑同一测试，期望全部通过。

### Task 2: 登录方式闭环

**Files:**
- Modify: `frontend_admin/src/pages/user/login/index.tsx`
- Create: `frontend_admin/src/services/manual/webauthn.ts`
- Test: `frontend_admin/src/services/manual/webauthn.test.ts`
- Modify: `frontend_admin/src/pages/user/login/login.flow.test.tsx`

- [ ] 写失败测试：忘记密码链接可达；邮箱验证码请求/确认；GitHub provider form；Passkey 请求参数和 credential 序列化。
- [ ] 运行定向 Vitest，确认新行为缺失。
- [ ] 实现验证码、provider redirect、WebAuthn 登录和错误恢复。
- [ ] 重跑定向 Vitest，期望全部通过。

### Task 3: 裂变规则真实生效

**Files:**
- Modify: `apps/referrals/services.py`
- Modify: `apps/referrals/api.py`
- Modify: `apps/referrals/schemas.py`
- Modify: `frontend_admin/src/pages/personal-business/overview/index.tsx`
- Modify: `e2e/test_frontend_admin_public_signup.py`
- Test: `tests/referrals/test_services.py`
- Test: `tests/referrals/test_api.py`

- [ ] 写失败测试：链接地址使用 `/dashboard/user/register`；禁用链接/邀请码后不归因；自动审核直接发奖；邀请人与受邀人分别入账且幂等。
- [ ] 运行 `DATABASE_URL=sqlite:///:memory: uv run pytest tests/referrals -q`，确认失败原因是规则尚未执行。
- [ ] 实现来源区分、分享能力输出和双向奖励。
- [ ] 重跑后端测试并更新 E2E 真实路由。

### Task 4: 通知偏好真实保存

**Files:**
- Replace: `frontend_admin/src/pages/account/settings/components/notification.tsx`
- Create: `frontend_admin/src/pages/account/settings/components/notification.test.tsx`

- [ ] 写失败测试：加载服务端类别、必选渠道禁用、切换 PATCH、失败回滚。
- [ ] 运行对应 Vitest，确认静态 `defaultChecked` 实现无法通过。
- [ ] 用 React Query 查询/更新生成客户端，服务端响应写回缓存。
- [ ] 重跑测试，期望通过。

### Task 5: 平台订阅订单、退款和开票处置

**Files:**
- Modify: `apps/subscriptions/api.py`
- Modify: `apps/subscriptions/schemas.py`
- Modify: `frontend_admin/config/routes.ts`
- Create: `frontend_admin/src/pages/platform-management/subscriptions/index.tsx`
- Create: `frontend_admin/src/pages/platform-management/subscriptions/index.test.tsx`
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Test: `tests/subscriptions/test_api.py`

- [ ] 写失败后端测试：平台订单和开票行包含组织与订单识别字段。
- [ ] 写失败前端测试：退款表单调用 refund API；开票表单调用 process API；成功后刷新表格。
- [ ] 运行后端和前端定向测试，确认失败。
- [ ] 实现序列化扩展、超级管理员路由和处置页面。
- [ ] 重跑定向测试，期望通过。

### Task 6: 配房分享生命周期

**Files:**
- Modify: `apps/house/models.py`
- Create: `apps/house/migrations/0021_housematchshare_lifecycle.py`
- Modify: `apps/house/match_schemas.py`
- Modify: `apps/house/match_services.py`
- Modify: `apps/house/match_api.py`
- Modify: `frontend_admin/src/services/manual/house.ts`
- Modify: `frontend_admin/src/pages/rental/houses/HouseMatchShareModal.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/HouseMatchShareModal.test.tsx`
- Modify: `tests/house/test_house_match.py`

- [ ] 写失败测试：我的分享分页、延期、失效、访问计数和失效后 410。
- [ ] 运行后端测试确认失败。
- [ ] 写失败组件测试：历史列表、复制、延期、失效和创建后刷新。
- [ ] 实现可审计字段、API、手写服务和历史 UI。
- [ ] 重跑后端及组件测试，期望通过。

### Task 7: RBAC 导航前置

**Files:**
- Modify: `apps/access/api.py`
- Modify: `apps/access/schemas.py`
- Modify: `config/api.py`
- Create: `frontend_admin/src/services/manual/navigationAccess.ts`
- Modify: `frontend_admin/src/app.tsx`
- Modify: `frontend_admin/src/access.ts`
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/access.test.ts`
- Test: `tests/access/test_permissions.py`

- [ ] 写失败后端测试：不同角色返回对应导航布尔能力。
- [ ] 写失败前端测试：能力映射为 Umi access，受限路由声明 access key。
- [ ] 实现能力 API、初始状态加载和路由门禁。
- [ ] 重跑前后端定向测试，期望通过。

### Task 8: 完整验证与完成度审计

- [ ] 运行受影响的 pytest：`tests/accounts tests/referrals tests/notifications tests/subscriptions tests/house/test_house_match.py tests/access`。
- [ ] 运行管理端相关 Vitest。
- [ ] 运行 `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin run tsc`。
- [ ] 运行 `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin run build`。
- [ ] 启动本地管理端，对注册、通知偏好、订阅后台和配房历史做浏览器验收；临时截图写入 `.codex/audits/frontend-admin-flow-closure/`。
- [ ] 按设计文档七条验收逐项核对文件、测试和运行态证据，不以局部测试代替全量要求。

## 计划自审

- 六个审查类别均有独立任务和可执行验收。
- 新后端接口均通过手写适配器接入，未要求手改生成客户端。
- 所有行为变更先写失败测试；配置文件和迁移是 TDD 例外，但由相邻行为测试覆盖。
- 当前工作树直接执行由用户明确授权；不执行 Git commit、push、reset 或清理命令。
