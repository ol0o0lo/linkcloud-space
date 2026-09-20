# 小程序码电脑端登录设计

## 目标

管理端登录页默认展示小程序码。用户微信扫码进入小程序专用页面后，小程序自动调用 `wx.login`，后端以 `code + scene` 确认身份，电脑端轮询后建立浏览器 Session。新微信身份自动注册；相同 UnionID 自动关联既有微信账号。

公众号带参数二维码登录的后端、前端服务和回调代码全部保留，但管理端不展示入口，也不在小程序码配置失败时自动回退。

## 架构

- 抽取与微信通道无关的电脑扫码登录票据模块，统一处理浏览器绑定、轮询密钥、过期、一次性消费和状态转换。
- 公众号通道继续用公众号临时二维码与消息事件回调确认身份。
- 小程序通道调用 `getwxacodeunlimit` 生成二维码；小程序专用页面提交 `wx.login` code 和 scene，后端调用 `code2Session` 后标记票据。
- 电脑端完成登录时，根据票据中的 provider 和微信身份数据构建对应 allauth social login，复用自动注册、UnionID 合并及 MFA 流程。

## 接口

- `POST /api/users/auth/wechat-miniprogram/qr/`：电脑创建票据并返回小程序码数据 URL、轮询密钥和过期时间。
- `GET /api/users/auth/wechat-miniprogram/qr/{login_id}/`：电脑查询状态。
- `POST /api/users/auth/wechat-miniprogram/qr/{login_id}/complete/`：电脑建立浏览器 Session。
- `POST /api/users/auth/wechat-miniprogram/pc-login/confirm/`：小程序提交 scene 与一次性登录 code。

公众号原有 `/api/users/auth/wechat-official/qr/` 系列接口保持兼容。

## 小程序码

- 页面固定为 `pages/auth/pc-login`，scene 使用不超过 32 个字符的随机值。
- 后端缓存 access token，并调用微信不限制小程序码接口。
- 微信返回二进制图片时转为 `data:image/...;base64,...`，管理端可直接站内展示；微信返回 JSON 错误时转换为可读业务错误。
- 小程序码对应票据有效期为 5 分钟，二维码图片本身不作为认证凭据。

## 小程序页面

- 页面允许未登录访问，只在微信小程序构建中执行扫码确认。
- 读取启动参数 `scene`，自动调用 `wx.login`，再请求确认接口。
- 成功后展示“已确认，请返回电脑”；票据失效、code2Session 失败或网络异常时提供重试。
- 此页面只确认电脑登录，不创建小程序本地登录 Session，也不要求手机号。

## 安全与错误处理

- 票据绑定创建它的浏览器 Session，并额外使用不可预测的 poll token。
- scene、登录票据均一次性使用；重复确认和重复完成返回冲突。
- redirect 仅允许站内地址；创建与确认接口实施频率限制。
- AppSecret 只用于后端请求微信接口，不下发给任一前端。
- 已启用 MFA 的账号扫码后继续在电脑端完成 MFA。

## 验证

- 后端覆盖二维码创建、确认、自动注册、UnionID 合并、过期、防重放和公众号回归测试。
- 管理端覆盖小程序码展示、轮询、完成登录与错误重试。
- 小程序覆盖 scene 读取、自动确认、成功及重试状态。

