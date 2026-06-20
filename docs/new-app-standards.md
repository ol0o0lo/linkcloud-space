# 新增 App 标准

## 1. 什么时候拆新 app

满足以下条件之一时，再新增 app：

- 已形成独立业务域，有自己的模型、接口和权限边界
- 后续会持续扩展，不适合继续塞进现有 app
- 需要独立维护后台页面、服务层或外部对接

以下情况通常不拆新 app：

- 只是给现有业务补字段或补少量接口
- 只是现有 app 内的一个子流程
- 只有零散工具函数，没有独立业务边界

## 2. 命名规则

- app 名称使用清晰稳定的业务名词，优先复数形式
- 与现有风格保持一致，例如 `accounts`、`notifications`、`wallet`
- 不使用宽泛名称，例如 `common`、`helpers`、`misc`、`biz`

## 3. 推荐文件

基础结构：

```text
apps/<app>/
  __init__.py
  api.py
  constants.py
  models.py
  schemas.py
  services.py
  migrations/
```

按需新增：

- `utils.py`
- `admin.py`
- `middleware.py`
- `providers/`
- `management/commands/`
- `templates/`

不要为了“看起来完整”预建空文件或空目录。

## 4. 新 app 接入时要同步检查的事项

新增 app 前先判断是否应复用现有：

- 用户认证
- 组织上下文
- 团队体系

如果属于组织内业务，优先沿用现有组织和权限模型，不单独再造一套授权结构。

同时建议在实现前先阅读全局规范：

- [backend-standards.md](./backend-standards.md)
