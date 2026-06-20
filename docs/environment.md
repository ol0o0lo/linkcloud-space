# 环境变量说明

`.env` 由 epicenv 管理；schema 在 [pyproject.toml](../pyproject.toml) 的 `[tool.epicenv.variables]`。

生成本地 `.env`：

```bash
just create_env
```

`[.env.example](../.env.example)` 只作参考，不放真实密钥。

## 1. 本地最小配置

本地 Docker 开发通常只需确认：

- `DEBUG=on`
- `SECRET_KEY`
- `POSTGRES_USER`、`POSTGRES_DB`、`POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SITE_DOMAIN=localhost:8000`
- `SITE_SCHEME=http`
- `ACCOUNT_SIGNUP_OPEN=true`
- `MEDIA_S3_*`、`MINIO_ROOT_*`

WebAuthn / passkey 本地只用 `localhost`，不要用 `127.0.0.1`。

## 2. 第三方配置

新项目初期可先留空或关闭：

- GitHub 登录：`GITHUB_CLIENT_*`
- 微信：`WECHAT_*`
- 邮件：`EMAIL_URL`、`DEFAULT_FROM_EMAIL`
- 短信：`ALIYUN_SMS_*`、`TENCENT_SMS_*`
- 真实对象存储 / STS：`AWS_*` 或云厂商配置

没有短信供应商时可用：

```env
SMS_BACKEND=apps.base.sms.console.ConsoleSMSBackend
```

## 3. 生产前检查

- `DEBUG=off`
- `SECRET_KEY` 已更换
- `ALLOWED_HOSTS`、`CSRF_TRUSTED_ORIGINS` 正确
- `SITE_SCHEME=https`
- `DATABASE_URL`、`REDIS_URL`、`MEDIA_S3_*` 指向生产环境
- 邮件、短信、OAuth、微信等凭据已配置
- Celery worker / beat 分离运行

## 4. 隔离原则

新项目必须更换：

- `SECRET_KEY`
- 数据库名和密码
- Redis 连接或前缀
- bucket
- 第三方凭据

不要复用旧项目 `.env`，不要提交真实 `.env`。
