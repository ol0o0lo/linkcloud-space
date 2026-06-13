# frontend_admin 安全设置页账号绑定闭环设计

## 背景

`frontend_admin` 的“安全设置 > 账号绑定”页面当前仍是模板占位实现，展示的是淘宝、支付宝、钉钉三项静态数据，和项目实际启用的社交登录提供方不一致，也没有真实的查询、跳转、回跳刷新逻辑。

当前项目内与账号绑定相关的实际 provider 能力来自 `django-allauth`，其中本次页面范围内确认采用：

- `github`
- `weixin`

其中：

- `weixin` 指网页端微信开放平台登录能力
- `wechat_miniprogram` 虽然项目已接入，但不纳入本页面“微信绑定”口径

## 目标

将 `frontend_admin` 的“安全设置 > 账号绑定”页改造为真实可用的账号绑定入口，完成以下闭环：

1. 页面加载时读取当前用户的绑定状态
2. 页面只展示真实支持的绑定项
3. 未绑定时允许点击“绑定”
4. 点击后复用现有 allauth 浏览器端授权流程
5. 授权完成后回到管理端设置页
6. 页面重新拉取绑定状态并刷新展示

## 非目标

本次设计明确不包含以下范围：

- 不做解绑能力
- 不展示淘宝、支付宝、钉钉等模板占位项
- 不将 `wechat_miniprogram` 计入本页“微信已绑定”状态
- 不改主站 `frontend/` 的账户设置页
- 不新增自定义 OAuth 协议或独立绑定中间页

## 页面范围

本次仅调整 `frontend_admin` 内的“安全设置 > 账号绑定”视图。

页面固定展示两项：

1. GitHub
2. 微信

文案规则：

- `GitHub` 对应 provider `github`
- `微信` 对应 provider `weixin`

状态规则：

- 当前用户存在 `SocialAccount(provider="github")` 时，GitHub 显示“已绑定”
- 当前用户存在 `SocialAccount(provider="weixin")` 时，微信显示“已绑定”
- 其余情况显示“未绑定”
- 当前用户仅存在 `SocialAccount(provider="wechat_miniprogram")` 时，微信仍显示“未绑定”

## 后端设计

### 新增接口

建议在现有用户资料路由下新增接口：

- `GET /api/users/me/social-bindings/`

接口职责仅限于返回当前用户账号绑定页所需的最小状态，不承担发起绑定、解绑或 provider 配置探测等职责。

### 响应结构

建议返回最小结构：

```json
{
  "items": [
    {
      "provider": "github",
      "label": "GitHub",
      "connected": false
    },
    {
      "provider": "weixin",
      "label": "微信",
      "connected": true
    }
  ]
}
```

说明：

- `provider` 供前端做稳定识别
- `label` 供前端直接展示，避免在管理端重复维护映射
- `connected` 表示当前用户是否已绑定

本接口不返回 `wechat_miniprogram`，避免和本页产品口径冲突。

### 数据来源

接口基于当前登录用户关联的 `allauth.socialaccount.models.SocialAccount` 记录计算：

- 存在 `provider="github"` 即 `github.connected = true`
- 存在 `provider="weixin"` 即 `weixin.connected = true`

判断应按当前用户维度进行，不读取其他用户或组织范围信息。

### 权限与错误处理

- 未登录请求返回 `401`
- 已登录请求只返回自己的绑定状态
- 查询过程中的系统异常遵循项目现有 Ninja 错误处理约定

## 前端设计

### 组件改造

将 `frontend_admin` 账号绑定页从静态写死数据改为读取后端接口。

渲染项固定为两条：

1. GitHub
2. 微信

每条记录展示：

- 图标
- 标题
- 状态描述
- 操作按钮

展示规则：

- `connected = false` 时显示“当前未绑定 GitHub 账号”或“当前未绑定微信账号”
- `connected = true` 时显示“当前已绑定 GitHub 账号”或“当前已绑定微信账号”
- `connected = false` 时操作项显示“绑定”
- `connected = true` 时不显示操作入口，或展示不可点击“已绑定”状态文本

### 加载与刷新

页面进入账号绑定页时触发绑定状态请求。

需要处理：

- 初次加载 `loading`
- 请求失败时的错误提示
- 绑定完成回跳后的重新拉取

建议将查询逻辑放入该页面自己的 service 中，而不是混入资料页基础信息接口。

### 发起绑定

点击“绑定”时，前端不自行实现 OAuth 拼装逻辑，而是复用现有 allauth 浏览器端 provider redirect 流程。

推荐方式：

1. 前端按 provider 调用现有浏览器端 provider redirect 入口
2. 传入回跳地址，目标为管理端账号绑定页
3. 浏览器整页跳转到第三方授权页

本次设计接受“整页跳转”这种简单路径，不强求弹窗式绑定体验。

### 回跳约定

绑定成功或失败后，用户应回到管理端账号绑定页，例如：

- `/dashboard/account/settings?tab=binding`

如果现有管理端页面不是通过 `tab` 控制，也可以使用当前页面已存在的菜单选择机制，但最终回跳目标必须稳定指向账号绑定视图。

前端进入页面后应重新请求 `GET /api/users/me/social-bindings/`，以服务端真实状态为准更新 UI。

## 数据流

### 页面加载

1. 用户进入管理端安全设置页
2. 切换到“账号绑定”
3. 前端请求 `GET /api/users/me/social-bindings/`
4. 后端读取当前用户 `SocialAccount`
5. 返回 GitHub / 微信两项绑定状态
6. 前端渲染“绑定”或“已绑定”

### 点击绑定

1. 用户点击某一 provider 的“绑定”
2. 前端跳转到 allauth 浏览器端 provider redirect 流程
3. 用户完成第三方授权
4. allauth 完成社交账号连接
5. 浏览器回到管理端账号绑定页
6. 前端重新请求绑定状态接口
7. 页面刷新为最新状态

## 异常处理

本页仅处理和绑定闭环直接相关的问题：

- 绑定状态查询失败：显示通用错误提示，并允许刷新重试
- provider 未配置完成：跳转流程失败时提示“当前绑定能力未配置完成”
- 用户取消第三方授权：回到页面后提示“绑定未完成”
- 授权失败：回到页面后提示“绑定失败，请稍后重试”

本次不要求在前端区分过细的 provider 错误码，只要保证用户能回到页面且状态不被错误更新即可。

## 测试设计

### 后端测试

覆盖以下场景：

1. 未登录访问 `GET /api/users/me/social-bindings/` 返回 `401`
2. 当前用户无任何相关 `SocialAccount` 时，GitHub 和微信均返回未绑定
3. 当前用户存在 `SocialAccount(provider="github")` 时，GitHub 返回已绑定
4. 当前用户存在 `SocialAccount(provider="weixin")` 时，微信返回已绑定
5. 当前用户仅存在 `SocialAccount(provider="wechat_miniprogram")` 时，微信仍返回未绑定

### 前端测试

覆盖以下场景：

1. 页面渲染真实的两项 provider：GitHub、微信
2. 根据接口返回正确切换“绑定 / 已绑定”文案
3. 点击“绑定”时触发正确的跳转逻辑
4. 回跳后会重新拉取绑定状态
5. 接口失败时显示错误提示

## 实施建议

建议按以下顺序推进：

1. 补后端 `social-bindings` 查询接口及测试
2. 改造 `frontend_admin` 绑定页的静态列表和 service
3. 接入 allauth provider redirect 跳转
4. 完成回跳后的状态刷新和提示
5. 补前端测试

## 验收标准

满足以下条件即可认为本次改造完成：

1. 管理端账号绑定页不再显示淘宝、支付宝、钉钉
2. 页面只展示 GitHub 和微信两项
3. 状态来源于真实后端接口而非静态数据
4. 未绑定时点击“绑定”可以走通第三方授权跳转
5. 授权完成后能返回账号绑定页
6. 返回后页面能展示最新绑定状态
7. `wechat_miniprogram` 不会被误判为本页“微信已绑定”
