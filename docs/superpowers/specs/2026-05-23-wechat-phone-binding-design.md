# 小程序手机号授权绑定设计文档

**日期：** 2026-05-23
**状态：** 已确认，待实施

## 目标

在微信小程序 openid 登录（已实现）基础上，新增第二步手机号授权绑定：
用户完成 `wx.login()` 登录后，可选调用 `wx.getPhoneNumber()` 授权手机号，
服务端据此合并账号或绑定手机号。

## 范围

- A/B（手机验证码登录、与邮箱并存）**已有**，无需开发
- 本期只做 C：小程序 `wx.getPhoneNumber()` 手机号授权绑定
- 不做微信手机号授权的独立注册（必须先完成 openid 登录）

## 流程

```
步骤一（已实现）：
POST /_allauth/app/v1/auth/provider/token
{ "provider": "wechat_miniprogram", "process": "login", "token": { "client_id": "...", "id_token": "<wx.login code>" } }
→ 登录/创建空白 User，建立 session

步骤二（本期新增，可选）：
POST /api/auth/wechat-phone/
{ "phone_code": "<wx.getPhoneNumber code>" }
Cookie: sessionid=xxx（已登录）
→ 换取手机号，合并或绑定账号
```

## 端点设计

### `POST /api/auth/wechat-phone/`

**权限：** 必须已登录（`require_authenticated`）

**请求体：**
```json
{ "phone_code": "wx_phone_code_xxx" }
```

**处理逻辑：**
```
1. 获取/缓存 access_token（cache key: wechat_miniprogram_access_token，TTL 7000s）
2. 调微信 API 换取手机号
   POST https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=xxx
   Body: { "code": phone_code }
   → { "phone_info": { "phoneNumber": "13800138000", "countryCode": "86" } }
3. 标准化手机号：+86XXXXXXXXXX
4. 查找系统内是否有此手机号的 User B
   ├─ 有 User B 且 User B != 当前 User：
   │   将当前 User 的所有 SocialAccount 迁移到 User B
   │   当前 User 软删除（is_active=False）
   │   重新登录 User B（更新 session）
   │   返回 200
   └─ 无 User B：
       当前 User.phone = phone，phone_verified = True
       user.save()
       返回 200
```

**响应：**
```json
{ "phone": "+8613800138000", "merged": false }
```
或合并场景：
```json
{ "phone": "+8613800138000", "merged": true }
```

**错误：**
- 微信 API 返回 errcode → 400
- 手机号已绑定当前账号 → 200（幂等）

## access_token 获取与缓存

```python
def get_miniprogram_access_token(app) -> str:
    from django.core.cache import cache
    key = "wechat_miniprogram_access_token"
    token = cache.get(key)
    if token:
        return token
    resp = requests.post(
        "https://api.weixin.qq.com/cgi-bin/token",
        params={
            "grant_type": "client_credential",
            "appid": app.client_id,
            "secret": app.secret,
        },
        timeout=10,
    )
    data = resp.json()
    token = data["access_token"]
    cache.set(key, token, timeout=7000)
    return token
```

## 账号合并细节

- **SocialAccount 迁移**：`SocialAccount.objects.filter(user=current_user).update(user=user_b)`
- **软删除空白账号**：`current_user.is_active = False; current_user.save()`
- **重新登录**：调 allauth `login(request, user_b)` 更新 session
- **原因**：防止同一 openid 再次登录时重新创建空白账号（is_active=False 的账号 allauth 不会用）

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/accounts/wechat_phone.py` | 新建 | access_token 获取、手机号换取、合并逻辑 |
| `apps/accounts/api.py` | 修改 | 新增 `POST /api/auth/wechat-phone/` 端点 |
| `apps/accounts/schemas.py` | 修改 | 新增 `WechatPhoneIn`、`WechatPhoneOut` schema |
| `config/api.py` | 确认 | 端点已挂载（accounts router 已注册） |
| `apps/accounts/tests/test_wechat_phone.py` | 新建 | 全部测试 |

## 测试策略（TDD）

### 测试文件：`apps/accounts/tests/test_wechat_phone.py`

测试顺序即实现顺序：

1. **access_token 缓存测试**：首次调用发请求，第二次复用 cache
2. **换取手机号测试**：mock 微信 API，验证返回 `+86XXXXXXXXXX`
3. **未登录拒绝**：未带 session 返回 401
4. **绑定新手机号**：无已有账号，写入当前 User
5. **幂等测试**：同一手机号重复绑定，返回 200 不报错
6. **账号合并**：已有 User B 有此手机号，迁移 SocialAccount，软删除当前 User，session 切换到 User B
7. **微信 API 错误**：errcode 返回 400
