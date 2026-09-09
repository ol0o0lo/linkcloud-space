# 管理端公众号带参数二维码登录设计

## 目标

在 `frontend_admin` 登录页增加“使用微信登录”入口。用户点击后在站内弹窗中展示公众号临时带参数二维码：已关注用户扫码触发 `SCAN`，未关注用户先关注公众号并触发带 `EventKey` 的 `subscribe`。扫码后不要求二次确认，原电脑自动完成登录；系统内不存在对应身份时自动注册用户。

## 前提

- 使用已认证且具备带参数二维码接口权限的公众号。
- 公众号消息服务器能够回调到生产环境公开 HTTPS 地址。
- 若需要与小程序或网站应用微信身份合并，公众号、小程序和网站应用必须绑定到同一个微信开放平台账号，以便取得相同 UnionID。
- 首版公众号消息配置采用明文模式，通过 HTTPS 和微信签名校验保护回调；安全模式的 AES 消息解密不在本次范围内。
- 生产环境启用 `ACCOUNT_SIGNUP_OPEN=true` 和 `SOCIALACCOUNT_AUTO_SIGNUP=true`，允许首次扫码自动注册。

## 设计选择

采用 Redis 临时票据、前端短轮询和 allauth 登录流程。

- 临时登录状态不写数据库，避免产生高频短生命周期记录和清理任务。
- 使用 2 秒轮询，不引入 WebSocket 或 SSE 连接基础设施。
- 公众号回调只识别扫码身份，不直接创建浏览器 Session；Session 必须由创建二维码的原浏览器完成。
- 用户创建和账号合并交给 allauth `SocialLogin` 流程，继续复用自动注册、MFA、登录信号和用户会话记录。
- 不使用网站应用 `WxLogin`，也不复用 `WECHAT_APP_ID`。

## 组件边界

### 公众号客户端

在 `apps.accounts` 下增加公众号客户端，职责仅包括：

- 获取并缓存公众号 `access_token`。
- 调用 `cgi-bin/qrcode/create` 创建 5 分钟临时字符串场景二维码。
- 生成或返回微信二维码图片地址。
- 通过公众号用户信息接口读取 OpenID 对应的 UnionID、昵称、头像和关注状态。

网络请求必须设置超时，并把微信 `errcode` 转为项目内可处理异常。`access_token` 按公众号 AppID 分区缓存，缓存时间略短于微信返回的有效期。

### 临时登录票据服务

Redis 中保存三类映射：

- `scene -> login_id`：供公众号事件定位电脑端登录请求。
- `login_id -> 登录状态`：供原浏览器轮询和消费。
- `browser_session -> active_login_id`：同一匿名浏览器只保留一个可消费的二维码请求。

登录记录包含：

- 随机 `login_id`。
- 随机公众号 `scene`。
- `poll_token` 的摘要，不保存明文。
- 创建二维码时的匿名浏览器 Session 标识摘要。
- 安全归一化后的登录后跳转地址。
- 当前状态、创建时间和过期时间。
- 扫码成功后暂存的公众号 OpenID。

二维码有效期和 Redis TTL 均为 300 秒。关闭弹窗不会延长有效期；同一浏览器重新创建二维码时更新 active login 映射，使旧请求不可继续消费。

### 公众号事件回调

新增独立 Django view，不挂在需要登录的 Ninja API 下：

- `GET /wechat/official-account/callback/`：验证 `signature`、`timestamp`、`nonce` 后原样返回 `echostr`，用于公众号服务器配置。
- `POST /wechat/official-account/callback/`：验证签名并解析事件 XML。

事件规则：

- `Event=SCAN`：直接使用 `EventKey` 作为 scene。
- `Event=subscribe`：移除 `EventKey` 的 `qrscene_` 前缀后作为 scene。
- 非扫码事件、未知 scene、过期 scene 直接忽略并返回成功。
- 微信重复推送使用 Redis 幂等键处理。
- 同一二维码只接受第一个有效微信身份，后续扫码不覆盖。

回调只把事件中的 OpenID 写入对应登录记录并将状态更新为 `scanned`，不在微信回调请求内调用用户资料接口。UnionID、昵称和头像等资料在原浏览器执行完成登录时获取，从而让回调尽快向微信返回成功。日志不记录 access token、AppSecret、完整 poll token 或原始敏感载荷。

### allauth 公众号 Provider

增加自定义 provider `wechat_official_account`，将公众号身份转换为 `SocialLogin`：

- `uid` 使用公众号 OpenID。
- `extra_data` 保存 `openid`、`unionid`、`nickname`、`headimgurl` 和关注状态。
- 新用户生成 `wx_<随机字符>` 用户名并设置不可用密码。
- 昵称可写入 `first_name`；公众号头像地址不直接写入当前 `MediaRefsField` 头像字段。

现有 `AccountAdapter.pre_social_login()` 的微信身份合并逻辑提取为共享规则，同时支持：

- `weixin`
- `wechat_miniprogram`
- `wechat_official_account`

匹配顺序为当前 provider 的 OpenID、UnionID 对应的已有微信社交账号、自动注册。UnionID 不存在时不能推断跨应用身份，只按公众号 OpenID 创建或查找账号。

## API 设计

### 创建二维码

`POST /api/users/auth/wechat-official/qr/`

请求携带可选的安全登录后跳转地址。后端确保当前匿名请求已经建立 Session，创建公众号二维码和 Redis 登录记录，返回：

```json
{
  "login_id": "公开请求标识",
  "poll_token": "仅当前浏览器持有的一次性密钥",
  "qr_image_url": "微信二维码图片地址",
  "expires_in": 300,
  "poll_interval": 2
}
```

### 查询状态

`GET /api/users/auth/wechat-official/qr/{login_id}/`

请求通过 `X-WeChat-Login-Token` 请求头携带 `poll_token`，避免一次性密钥出现在 URL 和访问日志中。接口只返回以下状态，不向前端暴露 OpenID、UnionID 或公众号资料：

- `pending`：等待扫码。
- `scanned`：已经识别微信身份，可以完成登录。
- `processing`：登录请求正在被消费。
- `expired`：二维码或登录票据已过期。
- `failed`：微信接口或身份处理失败。

### 完成登录

`POST /api/users/auth/wechat-official/qr/{login_id}/complete/`

后端同时校验：

- `poll_token` 摘要匹配。
- 当前浏览器 Session 与创建二维码时一致。
- 当前 `login_id` 仍然是该浏览器的 active login。
- 登录状态为 `scanned`。
- 票据尚未消费且仍在有效期内。

完成接口同样通过 `X-WeChat-Login-Token` 请求头接收 `poll_token`。服务通过 Redis 原子 `add` 锁把票据切换为消费中，根据回调暂存的 OpenID 获取公众号用户资料，再构建 `SocialLogin` 并调用 allauth 完成流程：

1. 已存在公众号 SocialAccount 时登录对应用户。
2. UnionID 命中小程序、网站应用或其他公众号身份时绑定到已有用户。
3. 无匹配且开放注册时，自动创建 User 和公众号 SocialAccount。
4. 已有账号启用 MFA 时返回 allauth 的待处理 MFA flow，不绕过验证。
5. 用户已停用、注册关闭或身份冲突时返回明确错误，不建立 Session。

成功消费后立即使票据失效。重复调用不能再次登录。

## 自动注册结果

首次扫码自动创建的用户：

- `username` 为唯一的 `wx_<随机字符>`。
- 密码不可用。
- `is_active=true`。
- 邮箱和手机号为空，后续可在账号设置中绑定。
- 昵称写入 `first_name`，超长内容按模型限制安全截断。
- 微信身份保存在 `SocialAccount(provider="wechat_official_account")`。
- 不自动创建组织；登录后沿用当前无组织用户流程创建或加入组织。

自动注册仍服从项目全局注册开关，不在公众号登录内部绕过 `ACCOUNT_SIGNUP_OPEN`。

## 前端交互

登录页在 GitHub 和通行密钥入口附近增加“使用微信登录”按钮。点击后打开 Ant Design Modal，状态包括：

- 正在生成二维码。
- 等待扫码，显示二维码和剩余有效时间。
- 已扫码，正在登录。
- 二维码已过期，提供刷新按钮。
- 登录失败，显示可执行错误并允许重新生成。

弹窗打开后按后端返回间隔轮询。收到 `scanned` 后停止轮询并调用完成接口：

- 已完成认证时复用现有 `finishLogin()`，恢复用户、组织状态并跳转到原目标页面。
- 返回待处理 MFA flow 时关闭二维码状态，进入登录页现有 MFA UI。
- 组件卸载或弹窗关闭时停止计时器和请求，不在前端保存微信身份信息。

## 安全与限制

- scene、login_id 和 poll_token 分别随机生成，不能互相推导。
- poll_token 只返回给创建二维码的浏览器；二维码本身不包含 poll_token。
- 完成登录同时绑定 poll_token 和匿名浏览器 Session，防止其他浏览器仅凭 scene 消费票据。
- 创建二维码和轮询接口按 Session/IP 限流，前端不得高于服务端声明的轮询频率。
- 微信回调校验签名并对重复事件幂等处理。
- 登录跳转只接受管理端同源安全路径。
- 本方案已明确采用“扫码即登录”。二维码被截图转发后，扫码者会把自己的微信身份登录到二维码所属电脑；短有效期、单次消费和浏览器绑定只能缩小风险，不能消除这一产品风险。

## 配置

新增环境变量：

```text
WECHAT_OFFICIAL_ACCOUNT_APP_ID
WECHAT_OFFICIAL_ACCOUNT_APP_SECRET
WECHAT_OFFICIAL_ACCOUNT_TOKEN
```

公众号后台服务器地址配置为生产环境的 `/wechat/official-account/callback/`，消息加解密方式选择明文模式。AppSecret 和 access token 只存在于后端配置与缓存中。

## 测试

### 后端

- 公众号 GET 验证成功和无效签名拒绝。
- `SCAN` 与带 `qrscene_` 的 `subscribe` 正确归一化 scene。
- 重复事件、过期 scene、未知 scene 不重复处理。
- 创建二维码时正确调用微信 API 并写入 300 秒 Redis 票据。
- poll_token、Session、过期时间和单次消费校验。
- 已有公众号账号登录。
- 根据 UnionID 合并小程序和网站应用账号。
- 首次扫码自动创建 User 和 SocialAccount。
- 注册关闭、停用账号、微信接口失败和 MFA 待处理状态。

### 前端

- 点击按钮打开弹窗并显示加载状态。
- 成功展示二维码并按指定间隔轮询。
- 扫码后调用完成接口并执行现有登录成功流程。
- MFA 响应进入现有 MFA UI。
- 过期、失败、刷新和关闭弹窗会正确停止轮询。

### 实机验收

实机验收需要真实公众号配置和公网 HTTPS 回调，分别覆盖：

1. 已关注用户扫码触发 `SCAN` 并登录。
2. 未关注用户扫码、关注后触发 `subscribe` 并登录。
3. 新微信身份自动注册。
4. 与同开放平台小程序身份通过 UnionID 合并。
5. 二维码过期、刷新和重复扫码。

## 非目标

- 网站应用 `WxLogin` OAuth 扫码。
- 公众号网页授权 H5 登录。
- 扫码后的手机端二次确认。
- WebSocket 或 SSE 推送。
- 永久二维码。
- 自动下载公众号头像并写入媒体系统。
- 安全模式公众号消息 AES 解密。
