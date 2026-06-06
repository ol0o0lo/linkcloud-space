# Media 平台接入说明

## 业务字段约定

- 业务模型使用 `JSON list[int]` 保存媒体引用
- 列表顺序就是展示顺序
- 不允许重复 ID
- 删除某个 ID 只表示解除业务引用，不立即删除媒体文件

## 服务层约定

- 保存前调用 `validate_media_ids(media_ids)` 做存在性和重复校验
- 回显时调用 `get_media_list_info(media_ids)`，平台按输入顺序返回完整信息
- 业务自己负责权限校验

## Provider 约定

每个使用 `media_ids` 的业务模块都必须提供一个 provider，并把函数路径注册到 `MEDIA_REFERENCE_PROVIDERS`。

```python
# apps/example/media_references.py
from apps.example.models import ExampleThing


def collect_example_media_ids():
    media_ids = set()
    for row in ExampleThing.objects.values_list("media_ids", flat=True):
        if not row:
            continue
        media_ids.update(int(media_id) for media_id in row if media_id)
    return media_ids
```

```python
# config/settings/_base.py
MEDIA_REFERENCE_PROVIDERS = [
    "apps.example.media_references.collect_example_media_ids",
]
```

## 清理策略

- 当 `MEDIA_REFERENCE_PROVIDERS` 为空时，媒体清理任务安全 no-op
- 当 provider 已接入后，只清理超过保留期且没有任何业务引用的媒体
