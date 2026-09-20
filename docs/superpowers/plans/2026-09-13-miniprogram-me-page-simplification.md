# 小程序“我的”页简化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 简化小程序“我的”页首屏，将低频账户信息和退出登录收进独立设置页。

**Architecture:** 保留现有账户深页和身份切换组件，只调整页面信息架构。新增一个受保护的账户设置页承接资料、绑定信息、安全和退出登录；“我的”页改用紧凑资料卡、三项常用服务网格和条件服务卡片。

**Tech Stack:** uni-app、Vue 3、TypeScript、Wot UI v2、SCSS、Node test runner

---

### Task 1: 注册设置页路由并锁定访问权限

**Files:**
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Modify: `frontend_miniprogram/tests/personal-account.test.ts`

- [ ] **Step 1: 为设置页补充失败测试**

在“个人账号深页有稳定路由且必须登录”测试中加入：

```ts
assert.equal(APP_ROUTES.accountSettings, '/pages/account/settings')
assert.equal(isProtectedAccountRoute(APP_ROUTES.accountSettings), true)
```

- [ ] **Step 2: 运行测试并确认新断言失败**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram test`

Expected: `APP_ROUTES.accountSettings` 尚未定义，测试失败。

- [ ] **Step 3: 添加设置页路由**

在 `APP_ROUTES` 的账户路由区域加入：

```ts
accountSettings: '/pages/account/settings',
```

并在 `protectedAccountRoutes` 中加入：

```ts
APP_ROUTES.accountSettings,
```

- [ ] **Step 4: 运行测试并确认路由测试通过**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram test`

Expected: 全部 Node 测试通过。

### Task 2: 新增账户设置页

**Files:**
- Create: `frontend_miniprogram/src/pages/account/settings.vue`
- Modify: `frontend_miniprogram/tests/personal-account.test.ts`

- [ ] **Step 1: 添加设置页结构测试**

读取 `src/pages/account/settings.vue` 并断言它包含以下内容：

```ts
assert.match(settingsSource, /APP_ROUTES\.profile/)
assert.match(settingsSource, /APP_ROUTES\.phoneVerification/)
assert.match(settingsSource, /APP_ROUTES\.accountSecurity/)
assert.match(settingsSource, /sessionStore\.logout\(\)/)
assert.match(settingsSource, /退出登录/)
assert.doesNotMatch(settingsSource, /@\/services\/openapi/)
```

- [ ] **Step 2: 运行测试并确认设置页不存在**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram test`

Expected: 读取 `settings.vue` 失败。

- [ ] **Step 3: 实现设置页**

页面使用 `AppPage`、`AppCustomNavigation`、`wd-cell-group`、`wd-cell` 和 `wd-button`。账户资料组包含个人资料、邮箱和手机号；安全组包含账号安全；底部危险文字按钮调用以下现有退出流程：

```ts
function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (!res.confirm)
        return
      await sessionStore.logout()
      appContextStore.resetToVisitor()
      uni.reLaunch({ url: APP_ROUTES.home })
    },
  })
}
```

手机号未验证时显示链接并跳转 `APP_ROUTES.phoneVerification`；已验证时只展示号码或“已验证”。

- [ ] **Step 4: 运行测试确认设置页结构通过**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram test`

Expected: 全部 Node 测试通过。

### Task 3: 简化“我的”页布局

**Files:**
- Modify: `frontend_miniprogram/src/pages/me/me.vue`
- Modify: `frontend_miniprogram/tests/personal-account.test.ts`

- [ ] **Step 1: 添加简化布局测试**

断言“我的”页使用设置路由并移除静态绑定信息和直接退出操作：

```ts
assert.match(meSource, /APP_ROUTES\.accountSettings/)
assert.match(meSource, /AppModeSwitcher variant="compact"/)
assert.doesNotMatch(meSource, /title="邮箱"/)
assert.doesNotMatch(meSource, /title="手机号"/)
assert.doesNotMatch(meSource, /handleLogout/)
assert.doesNotMatch(meSource, /退出登录/)
```

- [ ] **Step 2: 运行测试并确认旧页面不符合新结构**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram test`

Expected: 新增断言失败。

- [ ] **Step 3: 重构页面模板与脚本**

删除首页退出函数、手机号跳转函数、资料页跳转函数和账号安全跳转函数，新增设置页跳转：

```ts
function openAccountSettings() {
  uni.navigateTo({ url: APP_ROUTES.accountSettings })
}
```

顶部资料卡改为头像与昵称摘要，下方复用：

```vue
<AppModeSwitcher variant="compact" />
```

常用服务使用三列紧凑网格展示钱包、实名认证和推广。条件性的房东服务、组织管理继续沿用现有判断。页面底部使用单个 `wd-cell` 进入设置页，不展示退出按钮。

- [ ] **Step 4: 收紧样式**

资料卡高度改为内容驱动；常用服务网格使用三列等宽布局；各功能组统一使用 28–32rpx 圆角和 20–28rpx 间距；删除旧的 `.section-title`、`.logout-action` 与账户长列表专用样式。

- [ ] **Step 5: 运行测试确认页面结构通过**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram test`

Expected: 全部 Node 测试通过。

### Task 4: 类型检查与视觉验证

**Files:**
- Verify: `frontend_miniprogram/src/pages/me/me.vue`
- Verify: `frontend_miniprogram/src/pages/account/settings.vue`
- Verify: `frontend_miniprogram/src/modules/routes.ts`

- [ ] **Step 1: 运行 Vue 类型检查**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram type-check`

Expected: `vue-tsc --noEmit` 退出码为 0。

- [ ] **Step 2: 运行相关 ESLint 检查**

Run: `source "$NVM_DIR/nvm.sh" && nvm use 22 && pnpm --dir frontend_miniprogram exec eslint src/pages/me/me.vue src/pages/account/settings.vue src/modules/routes.ts tests/personal-account.test.ts`

Expected: ESLint 退出码为 0。

- [ ] **Step 3: 视觉检查关键状态**

确认普通租客身份首屏不再出现邮箱、手机号和退出红框；房东身份仍显示公开店铺；组织身份仍按权限显示组织管理中心；设置页可以进入资料、安全、手机验证并完成退出确认。

本计划不包含 Git 提交步骤，以遵守项目“除非要求否则不操作 Git”的约定。
