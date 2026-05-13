# 移除 Mailpit，统一使用 163 邮箱 SMTP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去掉 Mailpit 容器服务，开发和生产环境统一使用 163 邮箱 SMTP 发送邮件，通过环境变量配置。

**Architecture:** 删除 compose.yml 中的 mailpit 服务及相关 depends_on，将 `_base.py` 中按 INSTANCE 分支的邮件配置合并为单一统一配置，移除 `django-ses` 依赖。

**Tech Stack:** Django 内置 SMTP backend，`dj-email-url` 解析 EMAIL_URL，163 邮箱 SMTP（端口 465，SSL）

---

### Task 1: 修改 compose.yml，移除 mailpit

**Files:**
- Modify: `compose.yml`

- [ ] **Step 1: 删除 mailpit 服务块**

打开 `compose.yml`，删除以下整段（约第 34-48 行）：

```yaml
  mailpit:
    container_name: mailpit
    image: axllent/mailpit
    init: true
    ports:
      - "127.0.0.1:8025:8025"
      - "127.0.0.1:1025:1025"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8025/livez"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

- [ ] **Step 2: 删除 web 服务中对 mailpit 的 depends_on**

在 `web` 服务的 `depends_on` 块中，删除：

```yaml
      mailpit:
        condition: service_healthy
```

- [ ] **Step 3: 删除 worker 服务中对 mailpit 的 depends_on**

在 `worker` 服务的 `depends_on` 块中，删除：

```yaml
      mailpit:
        condition: service_healthy
```

- [ ] **Step 4: 验证 compose 文件语法**

```bash
docker compose config --quiet
```

预期输出：无错误（退出码 0）

- [ ] **Step 5: 提交**

```bash
git add compose.yml
git commit -m "chore: remove mailpit container service"
```

---

### Task 2: 修改 `_base.py`，统一邮件配置

**Files:**
- Modify: `config/settings/_base.py`

- [ ] **Step 1: 替换邮件配置分支**

找到以下代码段（约第 370-385 行）：

```python
if INSTANCE != "prod":
    # See https://github.com/migonzalvar/dj-email-url for more examples on how to set the EMAIL_URL
    email = env.dj_email_url(
        "EMAIL_URL",
        default="smtp://mailpit:1025",
    )
    DEFAULT_FROM_EMAIL = email.get("DEFAULT_FROM_EMAIL", "webmaster@localhost")
    EMAIL_HOST = email["EMAIL_HOST"]
    EMAIL_PORT = email["EMAIL_PORT"]
    EMAIL_HOST_PASSWORD = email["EMAIL_HOST_PASSWORD"]
    EMAIL_HOST_USER = email["EMAIL_HOST_USER"]
    EMAIL_USE_TLS = email["EMAIL_USE_TLS"]
else:
    # Use Django SES as the email backend for the production instance
    DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="")
    EMAIL_BACKEND = "django_ses.SESBackend"
```

替换为：

```python
# Email — unified SMTP config for all environments.
# Set EMAIL_URL in .env, e.g.:
#   smtp+ssl://your@163.com:授权码@smtp.163.com:465
# See https://github.com/migonzalvar/dj-email-url for URL format examples.
email = env.dj_email_url("EMAIL_URL", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="")
EMAIL_HOST = email.get("EMAIL_HOST", "")
EMAIL_PORT = email.get("EMAIL_PORT", 465)
EMAIL_HOST_PASSWORD = email.get("EMAIL_HOST_PASSWORD", "")
EMAIL_HOST_USER = email.get("EMAIL_HOST_USER", "")
EMAIL_USE_TLS = email.get("EMAIL_USE_TLS", False)
EMAIL_USE_SSL = email.get("EMAIL_USE_SSL", False)
```

- [ ] **Step 2: 验证 Django 配置可以正常加载**

```bash
docker compose run --rm web python manage.py check
```

预期：`System check identified no issues (0 silenced).`

- [ ] **Step 3: 提交**

```bash
git add config/settings/_base.py
git commit -m "refactor: unify email config to single SMTP backend, remove SES branch"
```

---

### Task 3: 移除 django-ses 依赖

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: 删除 django-ses 依赖**

在 `pyproject.toml` 的 `[project] dependencies` 列表中，删除这一行：

```toml
    "django-ses~=4.3",
```

- [ ] **Step 2: 同步依赖**

```bash
docker compose run --rm web uv sync
```

预期：uv 正常解析，无报错

- [ ] **Step 3: 验证 Django 配置仍可正常加载**

```bash
docker compose run --rm web python manage.py check
```

预期：`System check identified no issues (0 silenced).`

- [ ] **Step 4: 提交**

```bash
git add pyproject.toml uv.lock
git commit -m "chore: remove django-ses dependency"
```

---

### Task 4: 更新 pyproject.toml 中的环境变量说明

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: 更新 EMAIL_URL 变量说明**

找到：

```toml
EMAIL_URL = { type = "str", default="smtp://mailpit:1025", help_text = "Email server connection URL (Mailpit for local development)" }
```

替换为：

```toml
EMAIL_URL = { type = "str", default = "", help_text = "SMTP connection URL，格式示例：smtp+ssl://your@163.com:授权码@smtp.163.com:465" }
```

- [ ] **Step 2: 更新 DEFAULT_FROM_EMAIL 变量说明**

找到：

```toml
DEFAULT_FROM_EMAIL = { type = "str", default = "", help_text = "Default email address for sending emails, required when using Django SES for sending emails on the production instance." }
```

替换为：

```toml
DEFAULT_FROM_EMAIL = { type = "str", default = "", help_text = "发件人邮箱地址，如 your@163.com，需与 EMAIL_URL 中的用户名一致。" }
```

- [ ] **Step 3: 提交**

```bash
git add pyproject.toml
git commit -m "docs: update EMAIL_URL and DEFAULT_FROM_EMAIL env var descriptions for 163 SMTP"
```

---

### Task 5: 更新 .env，填写 163 SMTP 配置

**Files:**
- Modify: `.env`（本地文件，不提交）

- [ ] **Step 1: 在 .env 中设置邮件变量**

打开 `.env`，找到 `EMAIL_URL` 和 `DEFAULT_FROM_EMAIL`，填入 163 邮箱信息：

```
EMAIL_URL=smtp+ssl://your@163.com:你的授权码@smtp.163.com:465
DEFAULT_FROM_EMAIL=your@163.com
```

> **注意**：`your@163.com` 替换为真实邮箱，`你的授权码` 替换为在 163 邮箱「设置 → POP3/SMTP/IMAP」中生成的授权码（不是登录密码）。

- [ ] **Step 2: 重启服务并验证配置加载**

```bash
docker compose up -d web
docker compose run --rm web python manage.py shell -c "from django.conf import settings; print(settings.EMAIL_HOST, settings.EMAIL_PORT, settings.EMAIL_USE_SSL)"
```

预期输出：`smtp.163.com 465 True`

- [ ] **Step 3: 发送测试邮件**

```bash
docker compose run --rm web python manage.py shell -c "
from django.core.mail import send_mail
send_mail('测试邮件', '这是一封测试邮件', None, ['your@163.com'])
print('发送成功')
"
```

预期：控制台输出 `发送成功`，收件箱收到测试邮件。

---

## 完成标志

- `docker compose up` 启动成功，无 mailpit 相关报错
- `python manage.py check` 无 issues
- 测试邮件发送成功，163 收件箱收到邮件
- `django-ses` 已从依赖中移除
