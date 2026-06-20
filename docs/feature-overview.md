# 功能总览

只描述“当前仓库已有能力”，不描述实现细节。

## 1. 入口

- `/`：Django 临时跳转页
- `/dashboard/`：`frontend_admin`
- `/h5/`：`frontend_miniprogram` H5
- `/api/`：统一 Ninja API
- `/_allauth/`：allauth headless 认证接口

## 2. 认证与账号 `apps/accounts`

- 邮箱/密码登录
- 注册、邮箱验证、密码重置
- 手机验证码流程
- GitHub 登录
- 微信开放平台 / 小程序登录与手机号绑定
- MFA：TOTP、恢复码、WebAuthn
- 用户头像上传与裁剪
- 管理员 impersonate / hijack
- 用户管理：列表、创建、更新、启停、设密码、重置 MFA、解绑手机号/微信

## 3. 实名认证 `apps/accounts`

- 用户查看实名状态
- 提交实名认证
- 驳回/撤销后重提
- 实名时间线日志
- 后台查看、通过、驳回、撤销

## 4. 组织体系 `apps/organizations`

- 创建组织
- 切换当前组织
- 设置主组织
- 更新组织资料
- 组织归档/恢复
- 转移 owner
- 成员与邀请管理

## 5. 团队与权限 `apps/teams` / `apps/access`

- 团队列表、详情、创建、更新、删除
- 权限点查询
- 组织/团队角色管理
- 组织/团队角色绑定

## 6. 通知 `apps/notifications`

- 通知列表、详情、未读统计
- 单条/批量已读未读
- 批量删除
- 通知偏好
- 站内 + 邮件双通道

## 7. 设置 `apps/settings`

- 用户级设置
- 组织级设置
- 团队级设置

## 8. 媒体 `apps/media`

- OSS/STS 临时上传凭证
- 前端直传后确认登记
- 服务端上传
- 统一媒体文件记录
- 媒体引用校验、回显、延迟清理

详见 [media-platform.md](./media-platform.md)。

## 9. 前端结构

- `frontend_admin/`：后台管理端
- `frontend_miniprogram/`：小程序端 + H5

详见 [frontend-structure.md](./frontend-structure.md)。

## 10. 基础设施

- Docker Compose
- Just 命令
- uv / epicenv
- Ruff、Ty、ESLint、djLint
- pytest、Playwright、model-bakery
- gunicorn、WhiteNoise、S3/MinIO、Celery + Redis

## 11. 优先复用的公共能力

- 认证与多端登录
- 组织、团队、多租户上下文
- RBAC
- 通知
- 媒体
- 设置
- 实名认证流程

新增业务优先基于这些能力扩展，不平行再造。
