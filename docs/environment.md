# 环境变量说明

项目使用 epicenv 管理 `.env`，变量 schema 定义在 [pyproject.toml](../pyproject.toml) 的 `[tool.epicenv.variables]` 中。新项目优先用以下命令生成真实 `.env`：

```bash
just create_env
```

[.env.example](../.env.example) 只作为阅读和 CI 配置参考，不应该直接提交真实密钥。

## 本地开发最小配置

本地 Docker 开发通常只需要确认这些变量：

- `DEBUG=on`
- `SECRET_KEY`：每个项目重新生成
- `POSTGRES_USER`、`POSTGRES_DB`、`POSTGRES_PASSWORD`
- `DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}`
- `SITE_DOMAIN=localhost:8000`
- `SITE_SCHEME=http`
- `ACCOUNT_SIGNUP_OPEN=true`
- `MEDIA_S3_*` 和 `MINIO_ROOT_*` 使用 MinIO 默认值即可

WebAuthn / passkey 本地调试要求站点域名使用 `localhost`，不要使用 `127.0.0.1`。

## 第三方能力如何处理

新项目第一天可以先关闭或留空这些配置：

- GitHub 登录：`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`
- 微信登录/小程序：`WECHAT_*`
- 邮件：`EMAIL_URL`、`DEFAULT_FROM_EMAIL`
- 短信：`ALIYUN_SMS_*`、`TENCENT_SMS_*`
- 真实对象存储：`AWS_*` 或云厂商 STS 配置

如果还没有短信供应商，建议使用：

```env
SMS_BACKEND=apps.base.sms.console.ConsoleSMSBackend
```

这样验证码会输出到日志，适合本地开发。

## 生产配置检查

上线前至少检查：

- `DEBUG=off`
- `SECRET_KEY` 已更换，且不在代码仓库中
- `ALLOWED_HOSTS` 包含真实域名
- `CSRF_TRUSTED_ORIGINS` 包含 `https://真实域名`
- `SITE_SCHEME=https`
- `SECURE_PROXY_SSL_HEADER` 只在可信反向代理后启用
- `DATABASE_URL` 指向生产数据库
- `REDIS_URL` 指向生产 Redis
- `MEDIA_S3_*` 指向生产对象存储
- 邮件和短信凭据已经配置并验证
- Celery worker 和 beat 在生产环境分离运行

## 配置隔离原则

从模板启动新项目时，务必更换：

- `SECRET_KEY`
- 数据库名和数据库密码
- Redis 前缀或连接
- 对象存储 bucket
- 邮件、短信、OAuth、微信等第三方凭据
- Docker 镜像名和项目 slug

不要复用旧项目 `.env`，也不要把真实 `.env` 提交进仓库。
