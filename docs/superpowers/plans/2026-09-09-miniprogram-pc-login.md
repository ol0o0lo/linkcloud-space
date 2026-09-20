# 小程序码电脑端登录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将管理端扫码登录切换为站内展示的小程序码，扫码后自动让电脑端登录，同时完整保留但隐藏公众号登录通道。

**Architecture:** 把现有公众号票据抽成通用电脑扫码票据，公众号与小程序分别负责生成二维码和确认微信身份。小程序通过 `getwxacodeunlimit` 与 `code2Session` 完成确认，电脑端继续使用 allauth browser social login 建立 Session。

**Tech Stack:** Django 5、django-ninja、django-allauth、Redis cache、React/Umi/Ant Design、uni-app/Vue 3/wot-ui-v2、pytest、Vitest。

---

### Task 1: 通用电脑扫码票据

**Files:**
- Create: `apps/accounts/providers/wechat_pc_login/tickets.py`
- Modify: `apps/accounts/providers/wechat_official_account/tickets.py`
- Test: `tests/accounts/test_wechat_official_login.py`

- [ ] 用测试固定现有公众号票据的浏览器绑定、状态转换和一次性消费行为。
- [ ] 实现通用票据，记录 `provider` 和 `identity_data`，并限制 scene 不超过 32 字符。
- [ ] 将公众号票据模块改为兼容导出，保持现有调用点和缓存中的短期行为兼容。
- [ ] 运行 `docker compose exec web pytest tests/accounts/test_wechat_official_login.py -q`，预期全部通过。

### Task 2: 小程序码客户端

**Files:**
- Modify: `apps/accounts/providers/wechat_miniprogram/client.py`
- Test: `tests/accounts/test_wechat_miniprogram_pc_login.py`

- [ ] 添加失败测试，覆盖 access token 缓存、`getwxacodeunlimit` 请求参数、图片响应和微信 JSON 错误。
- [ ] 实现 `create_unlimited_qr(scene, page, expire_seconds)`，返回图片 data URL，且绝不输出 AppSecret。
- [ ] 运行 `docker compose exec web pytest tests/accounts/test_wechat_miniprogram_pc_login.py -q`，预期客户端测试通过。

### Task 3: 小程序电脑登录 API

**Files:**
- Modify: `apps/accounts/schemas.py`
- Modify: `apps/accounts/api.py`
- Test: `tests/accounts/test_wechat_miniprogram_pc_login.py`

- [ ] 添加创建、查询、确认、完成登录接口的失败测试。
- [ ] 创建小程序码接口，返回 `login_id`、`poll_token`、`qr_image_url`、过期时间和轮询间隔。
- [ ] 确认接口调用 `jscode2session`，把 `openid/unionid` 写入票据，不创建小程序本地 Session。
- [ ] 完成接口使用 `wechat_miniprogram` provider 建立浏览器 Session，并复用自动注册、UnionID 合并及 MFA。
- [ ] 添加过期、浏览器不匹配、重复确认、重复完成、关闭注册和频率限制测试。
- [ ] 同时运行小程序电脑登录与公众号登录测试，预期两套通道通过。

### Task 4: 小程序扫码确认页

**Files:**
- Create: `frontend_miniprogram/src/pages/auth/pc-login.vue`
- Create: `frontend_miniprogram/src/services/manual/pc-login.ts`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Test: `frontend_miniprogram/tests/pc-login.test.ts`

- [ ] 添加页面服务测试，验证提交 `{ scene, code }` 到确认接口。
- [ ] 页面读取 `onLoad` 的 scene，调用现有微信登录适配器取得 code，然后自动确认。
- [ ] 展示处理中、成功、失败及重试状态；成功文案引导用户返回电脑。
- [ ] 将页面声明为无需登录访问，避免路由守卫重定向。
- [ ] 在 Node 22 下运行相关测试和类型检查。

### Task 5: 管理端切换为小程序码

**Files:**
- Create: `frontend_admin/src/services/manual/wechatMiniprogramPcLogin.ts`
- Create: `frontend_admin/src/pages/user/login/wechat-miniprogram-login-modal.tsx`
- Create: `frontend_admin/src/pages/user/login/wechat-miniprogram-login-modal.test.tsx`
- Modify: `frontend_admin/src/pages/user/login/index.tsx`

- [ ] 复制现有公众号弹窗的成熟轮询与 MFA 处理方式，替换为小程序 API 和用户文案。
- [ ] 管理端登录页只渲染小程序扫码组件，不提供公众号入口或配置失败回退。
- [ ] 保留 `wechat-official-login-modal.tsx`、对应 service 和测试文件，不删除、不改名。
- [ ] 在 Node 22 下运行新组件测试、登录流程测试与 TypeScript 检查。

### Task 6: 回归验证

**Files:**
- Verify only

- [ ] 运行公众号与小程序认证后端测试。
- [ ] 运行管理端扫码登录相关 Vitest。
- [ ] 运行小程序相关测试和类型检查。
- [ ] 对修改文件运行格式与静态检查，确认没有修改生成 service、多语言文件、`package.json` 或锁文件。
- [ ] 人工检查管理端显示小程序码、扫码打开 `pages/auth/pc-login`、电脑自动完成登录；公众号入口不可见但原接口仍可调用。

