# OSS STS 临时凭证接口设计

## 背景

前端需要直接上传文件到阿里云 OSS，避免后端做文件中转。后端负责签发临时凭证（STS Token），前端拿到凭证后直接调用阿里云 OSS JS SDK 上传，上传完成后将路径存入业务表。

## 接口

### GET /api/media/oss-token/

登录用户可调用，返回 STS 临时凭证和上传路径。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scope | str | 是 | 上传范围：`user` 或 `org` |
| filename | str | 是 | 原始文件名，仅用于提取扩展名 |

**路径生成规则：**

| scope | 路径格式 |
|-------|---------|
| `user` | `uploads/users/{user_id}/{uuid}.{ext}` |
| `org` | `uploads/orgs/{org_id}/{uuid}.{ext}` |

路径由后端生成，前端不能自定义，防止越权写入其他目录。

**返回（200）：**

```json
{
  "access_key_id": "STS.xxx",
  "access_key_secret": "xxx",
  "security_token": "xxx",
  "endpoint": "https://oss-cn-shenzhen.aliyuncs.com",
  "bucket": "linkcloud-space",
  "path": "uploads/users/1/a1b2c3d4.jpg",
  "expires_at": "2026-05-16T08:30:00Z"
}
```

**错误：**

- `400` scope 不合法
- `400` 文件扩展名不在白名单
- `401` 未登录
- `403` scope=org 但当前用户没有活跃组织

## 设计决策

### 1. 路径由后端生成

前端只传 `scope` 和 `filename`，路径完全由后端控制。防止前端传入任意路径覆盖其他用户的文件。

### 2. 扩展名白名单

只允许 `jpg`、`jpeg`、`png`、`webp`，其他扩展名返回 400。

### 3. STS 权限范围

STS Token 的 RAM Policy 限制只能写入当前请求生成的 `path`，不能写入其他路径：

```json
{
  "Action": ["oss:PutObject"],
  "Resource": ["acs:oss:*:*:linkcloud-space/uploads/users/1/a1b2c3d4.jpg"]
}
```

### 4. 凭证有效期

STS Token 有效期 15 分钟，足够完成一次上传。

### 5. scope=org 的租户隔离

使用 `request.org.id` 作为路径中的 `org_id`，确保租户间路径不重叠。如果当前用户没有活跃组织，返回 403。

### 6. 后续扩展

新增 `scope` 类型只需在白名单和路径生成逻辑中添加，接口不变。

## 实现位置

- 新建 `apps/media/` app
- `apps/media/api.py` — ninja Router，挂载到 `config/api.py`
- `apps/media/sts.py` — STS 凭证生成逻辑（调用阿里云 SDK）
- `config/settings/_base.py` — 新增 STS 相关环境变量

## 环境变量

```
ALIYUN_STS_ACCESS_KEY_ID=      # RAM 用户的 AK，有 AssumeRole 权限
ALIYUN_STS_ACCESS_KEY_SECRET=
ALIYUN_STS_ROLE_ARN=           # 授权角色的 ARN，如 acs:ram::xxx:role/oss-uploader
```

## 前端使用流程

```
1. GET /api/media/oss-token/?scope=user&filename=photo.jpg
2. 拿到凭证和 path
3. 用阿里云 OSS JS SDK 直传：
   client.put(path, file, { headers: { 'x-oss-security-token': security_token } })
4. 上传成功后将 path 存入业务接口（如 PATCH /api/rooms/{id}/）
```

## 依赖

- `aliyun-python-sdk-sts` 或 `alibabacloud-sts20150401`（阿里云 STS SDK）
- 阿里云 RAM 控制台：创建角色 `oss-uploader`，授权 `oss:PutObject` 到指定 bucket
