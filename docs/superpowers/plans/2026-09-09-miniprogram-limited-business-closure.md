# 小程序有限业务闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本仓库未授权 Git 操作，因此不创建 worktree、不暂存、不提交。

**Goal:** 让邀请链接直接进入小程序完成接受，让已知通知进入可处理业务页，并补齐组织端小区、楼栋和主动带看的最小写入闭环。

**Architecture:** 后端复用微信 access token 客户端生成 URL Link，并让两类邀请生产者统一调用；小程序通过公开统一邀请页适配组织和房东邀请。通知跳转使用纯领域解析器；组织端写入继续遵循 `page -> feature -> manual adapter -> generated OpenAPI client` 分层。

**Tech Stack:** Django 5、django-ninja、django-allauth、requests、pytest、uni-app、Vue 3、TypeScript、Pinia、Wot UI v2、Node test runner。

---

### Task 1: 微信 URL Link 服务和配置

**Files:**
- Modify: `apps/accounts/providers/wechat_miniprogram/client.py`
- Create: `apps/accounts/providers/wechat_miniprogram/links.py`
- Modify: `config/settings/_base.py`
- Modify: `config/settings/test_runner.py`
- Modify: `.env.example`
- Modify: `pyproject.toml`
- Test: `tests/accounts/test_wechat_phone.py`

- [ ] **Step 1: 写 URL Link 客户端失败测试**

覆盖合法 `path/query/expire_time/env_version` 请求、非法环境、微信业务错误和缺少 `url_link`。

- [ ] **Step 2: 运行定向测试确认缺少实现**

Run: `docker compose exec web pytest tests/accounts/test_wechat_phone.py -k url_link -q`

Expected: FAIL，提示 URL Link 函数不存在。

- [ ] **Step 3: 实现微信客户端和邀请链接构造器**

客户端调用 `https://api.weixin.qq.com/wxa/generate_urllink`。链接构造器只接受 `organization`、`landlord` 两类邀请，使用 `urllib.parse.urlencode` 生成查询参数，并从 `SOCIALACCOUNT_PROVIDERS.wechat_miniprogram.APP` 读取凭证。

- [ ] **Step 4: 增加发布配置**

增加：

```python
WECHAT_MINIPROGRAM_URL_LINK_ENABLED = env.bool("WECHAT_MINIPROGRAM_URL_LINK_ENABLED", default=True)
WECHAT_MINIPROGRAM_URL_LINK_ENV_VERSION = env("WECHAT_MINIPROGRAM_URL_LINK_ENV_VERSION", default="release")
```

测试设置关闭该开关；关闭时仅用于测试和明确的灰度配置，返回现有管理端链接。开关启用后微信失败不得回退。

- [ ] **Step 5: 重跑 URL Link 测试**

Expected: PASS。

### Task 2: 两类邀请生产者与幂等错误

**Files:**
- Create: `apps/base/invitation_receipts.py`
- Create: `apps/organizations/exceptions.py`
- Modify: `apps/organizations/models.py`
- Modify: `apps/organizations/api.py`
- Modify: `apps/organizations/schemas.py`
- Modify: `apps/organizations/templates/organizations/emails/invitation.html`
- Modify: `apps/house/landlord_invitations.py`
- Modify: `apps/house/api.py`
- Test: `tests/organizations/test_api.py`
- Test: `tests/organizations/test_models.py`
- Test: `tests/house/test_landlord_portal.py`

- [ ] **Step 1: 写发送链接和重复接受失败测试**

断言开关启用时短信、邮件和手动分享返回微信 URL Link；同一用户重复接受已消费邀请时仍返回成功；其他用户不能复用成功凭据。

- [ ] **Step 2: 运行邀请定向测试确认红灯**

Run: `docker compose exec web pytest tests/organizations/test_api.py tests/organizations/test_models.py tests/house/test_landlord_portal.py -q`

Expected: FAIL 于 URL Link 和消费后幂等断言。

- [ ] **Step 3: 接入邀请链接**

组织发送前计算一次 `action_url`，邮件模板直接使用该绝对地址。房东 `invitation_action_url()` 使用缓存邀请的失效时间生成 URL Link。关闭配置时保持现有管理端 URL，以便测试和灰度回滚。

- [ ] **Step 4: 增加成功凭据和稳定错误码**

成功凭据以 token HMAC、用户 ID 为缓存键，组织邀请存储 `organization_slug`，房东邀请存储接受接口原结果，TTL 不超过七天。使用 `AppException` 子类返回 `invitation.expired`、`invitation.recipient_mismatch`、`invitation.phone_verification_required` 和 `invitation.binding_conflict`。

- [ ] **Step 5: 暴露组织标识并重跑测试**

`PublicInviteOut` 增加 `organization_id`、`organization_slug`，供小程序接受成功后选择组织。Expected: PASS。

### Task 3: 统一邀请领域层和公开页面

**Files:**
- Create: `frontend_miniprogram/src/domain/invitations.ts`
- Create: `frontend_miniprogram/src/services/manual/invitations.ts`
- Create: `frontend_miniprogram/src/features/invitations/service.ts`
- Create: `frontend_miniprogram/src/pages/invitations/index.vue`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Modify: `frontend_miniprogram/src/modules/registry.ts`
- Modify: `frontend_miniprogram/src/core/errors/app-error.ts`
- Modify: `frontend_miniprogram/src/pages-landlord/invite/index.vue`
- Test: `frontend_miniprogram/tests/invitations.test.ts`
- Test: `frontend_miniprogram/tests/app-error.test.ts`

- [ ] **Step 1: 写邀请参数、展示模型和错误码失败测试**

测试仅接受白名单 kind、生成内部回跳路由、手机号邀请需要验证、组织和房东响应归一化，以及错误包中的 `error` 字段进入 `businessCode`。

- [ ] **Step 2: 运行 Node 定向测试确认红灯**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 && cd frontend_miniprogram && pnpm test tests/invitations.test.ts tests/app-error.test.ts`

Expected: FAIL，提示邀请领域模块和路由不存在。

- [ ] **Step 3: 实现 manual adapter 与 feature service**

组织公开查询使用 public scope，接受和拒绝使用 personal scope；房东邀请复用现有接口。页面不得直接导入 generated OpenAPI client。

- [ ] **Step 4: 实现公开统一邀请页**

页面声明 `excludeLoginPath: true`。未登录跳转登录；已登录但手机号邀请未验证时跳转手机号验证；成功后刷新上下文并切换组织或房东模式。组织邀请提供拒绝，房东邀请只提供稍后处理。

- [ ] **Step 5: 保留房东旧路由兼容并重跑测试**

旧房东邀请页声明公开并重定向到统一邀请路由。Expected: PASS。

### Task 4: 通知业务动作解析器

**Files:**
- Modify: `frontend_miniprogram/src/domain/notifications.ts`
- Modify: `frontend_miniprogram/src/pages/messages/detail.vue`
- Test: `frontend_miniprogram/tests/notifications.test.ts`

- [ ] **Step 1: 写表驱动通知映射失败测试**

覆盖任务 assignment、任务 task、公告、公告撤回、收益分配、订阅、过期通知、已知管理端 URL、HTTPS 外链、非法 ID 和未知相对路径。

- [ ] **Step 2: 运行通知测试确认红灯**

Run: `pnpm test tests/notifications.test.ts`

Expected: FAIL，提示解析器不存在。

- [ ] **Step 3: 实现动作联合类型与白名单解析**

解析结果为 `{ kind: 'internal', route, label }`、`{ kind: 'external', url, label }` 或 `null`。结构化数据优先，管理端路径仅匹配任务、公告、收益和订阅四类。

- [ ] **Step 4: 消息详情执行解析结果**

内部动作使用 `uni.navigateTo`，外部 HTTPS 在 H5 打开、在微信端复制；无动作时隐藏按钮并展示不可处理说明。

- [ ] **Step 5: 重跑通知测试**

Expected: PASS。

### Task 5: 小区和楼栋写入领域层

**Files:**
- Modify: `apps/house/schemas.py`
- Modify: `frontend_miniprogram/src/domain/organization-rental.ts`
- Modify: `frontend_miniprogram/src/services/manual/organization-rental.ts`
- Modify: `frontend_miniprogram/src/features/organization-rental/service.ts`
- Test: `tests/house/test_api.py`
- Test: `frontend_miniprogram/tests/organization-rental.test.ts`

- [ ] **Step 1: 写响应字段和 payload 归一化失败测试**

后端断言小区详情包含 `developer`、`built_year`、`description`；前端断言空数字转为 `null`、标签去重、编辑 payload 不包含图片和坐标。

- [ ] **Step 2: 运行定向测试确认红灯**

Run: `docker compose exec web pytest tests/house/test_api.py -k estate -q`

Run: `pnpm test tests/organization-rental.test.ts`

- [ ] **Step 3: 扩充小区详情并接入现有 OpenAPI 方法**

manual adapter 增加小区/楼栋详情、创建、PATCH 方法；feature 层暴露语义化函数。使用本地扩展类型承接后端新增小区字段，不手改生成文件。

- [ ] **Step 4: 实现纯函数 payload 构造器**

小区构造器负责文本清理和可空年份；楼栋构造器负责可选小区、正整数楼层、可空地下层/年份、标签去重。编辑 payload 仅包含本表单字段。

- [ ] **Step 5: 重跑测试**

Expected: PASS。

### Task 6: 小区和楼栋表单页面

**Files:**
- Create: `frontend_miniprogram/src/pages-org-rental/estates/form.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/buildings/form.vue`
- Modify: `frontend_miniprogram/src/pages-org-rental/estates/index.vue`
- Modify: `frontend_miniprogram/src/pages-org-rental/buildings/index.vue`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Test: `frontend_miniprogram/tests/organization-rental.test.ts`

- [ ] **Step 1: 写路由和页面边界失败测试**

断言新增路由构造器、列表存在新增入口、卡片进入编辑、表单不包含删除和图片写入。

- [ ] **Step 2: 查询 Wot UI v2 精确组件 API**

确认 `wd-picker`、`wd-popup`、`wd-switch`、`wd-input`、`wd-textarea` 的当前版本用法。

- [ ] **Step 3: 实现小区共用表单**

新建时初始化默认住宅类型；编辑时读取详情并预填。保存锁防止重复提交，成功后返回列表。

- [ ] **Step 4: 实现楼栋共用表单**

所属小区使用底部选择器并允许清空；地址和楼层必填；新建、编辑复用同一路由。

- [ ] **Step 5: 接入列表入口并重跑测试、类型检查**

Run: `pnpm test tests/organization-rental.test.ts && pnpm type-check`

Expected: PASS。

### Task 7: 主动创建带看

**Files:**
- Modify: `apps/house/schemas.py`
- Modify: `frontend_miniprogram/src/domain/organization-rental.ts`
- Modify: `frontend_miniprogram/src/services/manual/organization-rental.ts`
- Modify: `frontend_miniprogram/src/features/organization-rental/service.ts`
- Create: `frontend_miniprogram/src/pages-org-rental/viewings/form.vue`
- Modify: `frontend_miniprogram/src/pages-org-rental/viewings/index.vue`
- Modify: `frontend_miniprogram/src/pages-org-rental/houses/detail.vue`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Test: `tests/house/test_api.py`
- Test: `frontend_miniprogram/tests/organization-rental.test.ts`

- [ ] **Step 1: 写未来时间和 payload 失败测试**

后端断言过去预约时间返回字段错误；前端断言手机号、姓名清理，日期输出 ISO 字符串，联系人和负责人可空。

- [ ] **Step 2: 运行定向测试确认红灯**

Run: `docker compose exec web pytest tests/house/test_api.py -k viewing -q`

Run: `pnpm test tests/organization-rental.test.ts`

- [ ] **Step 3: 增加后端预约时间校验和前端 service**

仅创建输入拒绝过去时间，PATCH 保持现有历史数据维护能力。manual adapter 调用已有创建接口。

- [ ] **Step 4: 实现带看表单**

房源、联系人、负责人使用可搜索底部选择器；选择联系人后带入姓名手机号；日期时间使用 `wd-datetime-picker`，默认下一整点；从房源详情进入时预选房源。

- [ ] **Step 5: 接入两个入口并重跑测试**

成功后跳转新带看详情；列表 `onShow` 自动刷新。Expected: PASS。

### Task 8: 全量验证

**Files:**
- Verify only

- [ ] **Step 1: 后端定向测试**

Run: `docker compose exec web pytest tests/accounts/test_wechat_phone.py tests/organizations/test_api.py tests/organizations/test_models.py tests/house/test_landlord_portal.py tests/house/test_api.py -q`

Expected: PASS。

- [ ] **Step 2: 小程序静态检查和测试**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
cd frontend_miniprogram
pnpm lint
pnpm type-check
pnpm test
```

Expected: 全部 PASS。

- [ ] **Step 3: 构建 H5 和微信小程序**

Run: `pnpm build:h5:prod && pnpm build:mp:prod`

Expected: 两个构建成功。

- [ ] **Step 4: 记录真实环境限制**

URL Link 真机打开需要有效微信 AppID/AppSecret、已发布目标页面和微信体验版或正式版，自动化环境只能验证请求载荷，最终上线前必须完成 iOS、Android 真机验收。

