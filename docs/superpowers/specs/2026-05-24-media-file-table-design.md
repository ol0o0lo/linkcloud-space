---
name: media-file-table-design
description: MediaFile 统一文件表设计——支持前端直传回调登记和后端多文件上传两种路径
metadata:
  type: project
---

# MediaFile 统一文件表设计

## 背景

现有 `apps/media` 已支持前端直传 OSS（STS token 方案）。本设计在此基础上新增：

1. **文件表**（`MediaFile`）— 统一记录所有上传的媒体资产
2. **前端直传回调接口** — 前端直传 OSS 成功后，通知后端登记记录
3. **后端多文件上传接口** — 后端接收文件 → 上传 OSS → 登记记录 → 返回列表
4. **服务层** — 可被 API 和其他业务直接调用

---

## 数据模型

`apps/media/models.py` 新增 `MediaFile`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | AutoField | 主键 |
| `uploader` | FK → User (SET_NULL, nullable) | 上传者 |
| `resource_type` | CharField(32, choices) | 业务来源枚举 |
| `original_filename` | CharField(255) | 原始文件名 |
| `file` | FileField(storage=S3MediaStorage) | OSS 路径，`.url` 自动处理签名 |
| `file_size` | PositiveIntegerField | 文件大小（bytes） |
| `created_at` | DateTimeField(auto_now_add) | 创建时间 |

`ResourceType` 枚举（`TextChoices`）初始值：

```python
class ResourceType(models.TextChoices):
    AVATAR   = "avatar",   "用户头像"
    ORG_LOGO = "org_logo", "组织 Logo"
```

新增 `resource_type` 时修改此枚举并生成 migration。

---

## 服务层

`apps/media/services.py` 新增：

```python
def register_media_file(
    *,
    uploader: User,
    oss_path: str,
    original_filename: str,
    resource_type: str,
    file_size: int,
) -> MediaFile:
    """创建 MediaFile 记录，供 API 和业务层调用。"""
```

调用方：
- `POST /api/media/confirm/` 内部调用
- `POST /api/media/upload/` 内部调用（每个文件调用一次）
- 其他业务（如头像更新）可直接 import 调用，无需走 HTTP

---

## API 接口

### 现有（不变）

```
GET /api/media/oss-token/?scope=&filename=
```
返回 STS 临时凭证，前端直传 OSS 使用。

### 新增

#### `POST /api/media/confirm/` — 前端直传后登记

前端直传 OSS 成功后调用，登记文件记录。

入参（JSON）：

```json
{
  "oss_path": "uploads/users/1/abc123.png",
  "original_filename": "photo.png",
  "resource_type": "avatar",
  "file_size": 102400
}
```

返回：单个 `MediaFileOut`

#### `POST /api/media/upload/` — 后端多文件上传

后端接收文件，上传 OSS，登记记录，返回列表。

入参（multipart form）：

- `files`：一个或多个文件（`files[]`）
- `resource_type`：业务来源枚举值

返回：`MediaFileOut` 列表

---

## 统一返回 Schema

```python
class MediaFileOut(Schema):
    id: int
    resource_type: str
    original_filename: str
    url: str          # 由 file.url 生成，私有 bucket 自动带签名
    file_size: int
    created_at: datetime
```

---

## 错误处理

| 场景 | HTTP 状态码 |
|------|------------|
| `resource_type` 不在枚举内 | 422 |
| 文件扩展名不在白名单 | 422 |
| OSS 上传失败（后端上传路径） | 500 |
| 未登录 | 401（全局认证器处理） |

---

## 测试要点

- `register_media_file` 服务层单元测试（mock OSS）
- `confirm` 接口：合法入参 → 201，非法 resource_type → 422
- `upload` 接口：单文件、多文件、非法扩展名
- `MediaFile.file.url` 在测试环境返回可预测的路径
