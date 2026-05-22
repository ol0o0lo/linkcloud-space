# 移除 JWT 残留代码设计文档

**日期**: 2026-05-17  
**状态**: 已批准  
**范围**: 清理 JWT 相关依赖和配置，不涉及第三方认证替换方案

---

## 背景

项目早期为支持第三方客户端接入，引入了 `djangorestframework-simplejwt`，后迁移至 allauth headless JWT 策略（`JWTTokenStrategy`）。现在决定不使用 JWT，API 认证方式将在后续单独任务中处理。本次任务仅清理 JWT 相关残留。

## 当前认证架构

- **Vue SPA（浏览器）**: Django session + CSRF（`django_auth`）
- **Allauth headless**: `HEADLESS_ONLY = True`，所有认证通过 `/_allauth/browser/v1/` JSON API
- **JWT 残留**: allauth `JWTTokenStrategy` 配置、`PyJWT` 依赖、`ninja_auth.py` 薄封装文件

## 目标

移除所有 JWT 直接相关内容，保留 DRF 异常处理器（`drf_exceptions.py`）不动。

---

## 变更清单

### 1. `pyproject.toml`
- 移除 `"PyJWT>=2.8,<3"` 依赖

### 2. `config/settings/_base.py`
移除以下配置块：
```python
HEADLESS_TOKEN_STRATEGY = "allauth.headless.tokens.strategies.jwt.strategy.JWTTokenStrategy"
HEADLESS_JWT_ALGORITHM = "HS256"
HEADLESS_JWT_ACCESS_TOKEN_EXPIRES_IN = 1800
HEADLESS_JWT_REFRESH_TOKEN_EXPIRES_IN = 604800
HEADLESS_JWT_ROTATE_REFRESH_TOKEN = True
HEADLESS_JWT_STATEFUL_VALIDATION_ENABLED = False
```

### 3. `config/ninja_auth.py`
- 删除此文件（仅是 `django_auth` 的单行转发，无实际价值）
- 将所有 `from config.ninja_auth import django_auth` 改为 `from ninja.security import django_auth`

### 4. 测试文件
- `apps/accounts/tests/test_github_login.py`：移除对 JWT `access_token` 的断言（GitHub OAuth 回调不再期望返回 JWT token）

---

## 不变的内容

| 项目 | 原因 |
|------|------|
| `djangorestframework` 依赖 | `drf_exceptions.py` 仍在用 |
| `config/drf_exceptions.py` | 提供统一异常格式，与 JWT 无关 |
| `REST_FRAMEWORK` 配置（SessionAuthentication）| 与 JWT 无关 |
| `HEADLESS_ONLY = True` | 项目是纯 Vue SPA，无 Django 模板页面 |
| GitHub OAuth、phone 认证等 | 与 JWT 无关 |

---

## 后续任务（本次不做）

- 为第三方系统设计 API 认证方案（OAuth2 client credentials 或 API Key）

