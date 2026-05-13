# 设计文档：移除 Mailpit，统一使用 163 邮箱 SMTP 发送邮件

**日期**：2026-05-13  
**状态**：已批准

---

## 背景

项目基于 Django Base Site 模板启动，本地开发环境使用 Mailpit 容器拦截邮件。目标是：
- 去掉 Mailpit 容器，减轻 Docker 服务数量
- 开发和生产环境统一使用 163 邮箱 SMTP 发送真实邮件
- 使用 Django 内置 SMTP backend，零额外依赖

---

## 变更范围

### 1. `config/settings/_base.py`

**现状**：邮件配置按 `INSTANCE` 分支处理——非生产用 `EMAIL_URL`（默认 mailpit），生产用 `django-ses`。

**目标**：去掉分支，统一使用 `dj-email-url` 解析 `EMAIL_URL`，支持 163 的 SSL SMTP（端口 465）。

```python
# 统一邮件配置，不区分环境
email = env.dj_email_url("EMAIL_URL", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="")
EMAIL_HOST = email["EMAIL_HOST"]
EMAIL_PORT = email["EMAIL_PORT"]
EMAIL_HOST_PASSWORD = email["EMAIL_HOST_PASSWORD"]
EMAIL_HOST_USER = email["EMAIL_HOST_USER"]
EMAIL_USE_TLS = email["EMAIL_USE_TLS"]
EMAIL_USE_SSL = email.get("EMAIL_USE_SSL", False)
```

### 2. `compose.yml`

- 删除 `mailpit` 服务块（容器镜像、端口、healthcheck）
- 删除 `web` 服务的 `depends_on.mailpit`
- 删除 `worker` 服务的 `depends_on.mailpit`

### 3. `pyproject.toml`

- 更新 `EMAIL_URL` 变量的 `help_text` 和 `default`，说明 163 SMTP 格式
- 更新 `DEFAULT_FROM_EMAIL` 的 `help_text`
- 检查并移除 `django-ses` 依赖（如存在）

### 4. `.env`（仅说明，不提交）

用户需自行填写：
```
EMAIL_URL=smtp+ssl://your@163.com:你的授权码@smtp.163.com:465
DEFAULT_FROM_EMAIL=your@163.com
```

---

## 163 SMTP 参数

| 参数 | 值 |
|------|----|
| HOST | smtp.163.com |
| PORT | 465（SSL）或 994（SSL 备用） |
| USE_SSL | True |
| USE_TLS | False（SSL 和 TLS 不能同时开） |
| 用户名 | 完整邮箱地址，如 `xxx@163.com` |
| 密码 | 163 授权码（非登录密码） |

---

## 不在此次变更范围内

- 邮件模板内容
- allauth 邮件验证逻辑
- Celery 任务中的邮件调用
- 生产部署配置（Dockerfile 等）

---

## 风险说明

- 开发环境将发送真实邮件，163 免费邮箱单日发件有频率限制（约 500 封/天）
- 若 `EMAIL_URL` 未配置，邮件发送会失败并抛出异常，需确保 `.env` 中已填写
