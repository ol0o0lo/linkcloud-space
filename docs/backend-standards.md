# 后端开发规范

适用于所有后端 app。

## 1. 新建 App

仅在以下情况拆新 app：

- 已形成独立业务域
- 会持续扩展
- 需要独立模型、接口、权限或外部对接

不要为补字段、子流程、零散工具函数拆新 app。

命名：

- 用清晰业务名词，优先复数
- 保持现有风格，如 `accounts`、`notifications`、`wallet`
- 不用 `common`、`helpers`、`misc`、`biz`

推荐目录：

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

按需再加：`utils.py`、`admin.py`、`middleware.py`、`providers/`、`management/commands/`、`templates/`。

## 2. 文件职责

- `models.py`：模型、字段、约束、少量模型内方法
- `constants.py`：枚举、状态、类型、动作名
- `schemas.py`：输入输出结构、静态校验
- `services.py`：业务入口、数据库读写、状态流转、副作用、跨 app 协作
- `api.py`：router、鉴权入口、参数接收、调用 service、返回结果
- `utils.py`：纯函数工具；不查库、不写库、不触发副作用

## 3. 分层规则

- 静态校验放 `schemas.py`
- 动态业务规则和副作用放 `services.py`
- 不新增泛化 `helper.py`
- 不要用局部导入掩盖循环依赖；出现局部导入先检查依赖方向和职责拆分

## 4. 枚举与返回字段

- 枚举统一放 `constants.py`
- 枚举文案映射优先由枚举类自身提供
- 返回中保留原始枚举值字段，如 `status`、`source`
- 展示文案统一用 `__mapping` 后缀，如 `status__mapping`、`source__mapping`
- 不再新增 `*_label`
- `__mapping` 只用于展示，不作为写入字段

## 5. API 约定

- router 定义在 `apps/<app>/api.py`，再接入 `config/api.py`
- 分页统一使用 `page`、`page_size`
- 分页返回统一为 `{ items, total, page, page_size }`

## 6. 测试与前端联动

- 后端测试放 `tests/<app>/`
- 不在 `apps/<app>/tests/` 下写测试
- `frontend_admin` 接口先定义后端 schema/API，再生成 OpenAPI 客户端
- 不手改 `frontend_admin/src/services/openapi`

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin openapi
```

## 7. 复用优先

新增或维护业务 app 时，先判断是否应复用现有：

- 用户认证
- 组织上下文
- 团队体系
- 权限模型

组织内业务优先复用现有组织和权限结构，不再单独造一套。
