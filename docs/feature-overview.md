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

## 7. 团队运营 `apps/team_operations`

- 团队或组织公告的创建、发布、撤回与接收确认
- 日常任务下发、接受、完成、拒绝与取消
- 公告接收人和任务执行人的历史快照
- 个人日常工作看板
- 复用站内信分类、必达渠道、业务目标和跳转入口

通用业务工作流与通知平台的边界详见 [business-workflow-notification-design.md](./business-workflow-notification-design.md)。

## 8. 设置 `apps/settings`

- 用户级设置
- 组织级设置
- 团队级设置

## 9. 媒体 `apps/media`

- OSS/STS 临时上传凭证
- 前端直传后确认登记
- 服务端上传
- 统一媒体文件记录
- 媒体引用校验、回显、延迟清理

详见 [media-platform.md](./media-platform.md)。

## 10. 普通用户收藏

- 普通登录用户无需选择租户即可收藏公开业务对象
- 收藏、取消收藏均为幂等操作
- 取消收藏会物理删除关系，再次收藏会创建新关系和新的收藏时间
- 目标下架后保留收藏关系，但不再返回目标详情
- 支持汇总全部收藏及按业务类型筛选
- 当前支持房源、楼栋和小区收藏
- 各业务应用自行注册收藏目标，收藏核心不依赖具体业务或经营分析模块
- 提供目标类型、展示名称、顺序及当前用户收藏数量的能力接口
- 收藏列表先分页再批量解析当前页目标，并同时返回通用展示摘要和业务专属数据
- Analytics 自行监听新建的 `Favorite`：重复收藏和取消收藏不触发埋点，取消后再次收藏会因新建关系再次触发
- 收藏关系表示当前状态，经营分析独立保存历史行为；删除收藏关系不会删除或修改历史埋点
- 管理端“个人”分组根据后端能力动态生成类型页签，支持业务专用渲染器及未知类型通用卡片
- 管理端提供共享收藏状态与切换 Hooks；小程序/H5 暂未接入收藏页面

通用化边界和业务接入方式详见 [user-favorite-capability.md](./user-favorite-capability.md)。

## 11. 通用数据埋点与经营分析 `apps/analytics`

- 登录用户和匿名访客统一批量采集接口
- 显式事件类型与目标类型注册表
- 自动解析目标所属组织，客户端不能指定租户
- 匿名 ID、会话 ID 哈希和独立访客统计
- 属性白名单、公开目标过滤、限流、幂等和窗口去重
- 事件概览、按日趋势和目标排行
- 为各业务消费者提供通用经营分析数据
- 平台不内置具体业务语义，各业务通过注册表复用同一协议

平台边界、接口和新业务接入方式详见 [analytics-platform.md](./analytics-platform.md)。

## 12. 前端结构

- `frontend_admin/`：后台管理端
- `frontend_miniprogram/`：小程序端 + H5

详见 [frontend-structure.md](./frontend-structure.md)。

## 13. 基础设施

- Docker Compose
- Just 命令
- uv / epicenv
- Ruff、Ty、ESLint、djLint
- pytest、Playwright、model-bakery
- gunicorn、WhiteNoise、S3/MinIO、Celery + Redis

## 14. 优先复用的公共能力

- 认证与多端登录
- 组织、团队、多租户上下文
- RBAC
- 通知
- 团队运营任务与公告
- 媒体
- 设置
- 实名认证流程
- 普通用户收藏
- 行为埋点与经营分析

新增业务优先基于这些能力扩展，不平行再造。
