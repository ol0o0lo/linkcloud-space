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

## 4. 每个文件负责什么

`models.py`

- 定义 model、字段、约束
- 放少量与模型强绑定的方法
- 时间戳优先复用项目已有 mixin

`constants.py`

- 定义稳定复用的枚举、状态、类型、动作名

`schemas.py`

- 定义 API 输入输出
- 做只看请求体即可判断的校验
- 例如必填、类型、长度、枚举值、列表数量、字符串清洗

`services.py`

- 作为业务入口
- 负责数据库读写、状态流转、跨 app 协作和副作用
- API 层优先调用 service，不把复杂逻辑堆进 `api.py`

`api.py`

- 定义 Ninja router
- 接参数、做鉴权入口、调用 service、返回结果

`utils.py`

- 按需新增，只放纯函数工具
- 不查库、不写库、不写日志、不触发副作用

`admin.py`

- 需要 Django Admin 管理时再加

`management/commands/`

- 需要数据修复、导入、补偿、运维命令时再加

`templates/`

- 需要邮件模板或 Django 模板时再加

## 5. 分层规则

- schema 负责静态输入校验
- service 负责业务规则和副作用
- utils 只放纯工具
- 不新增泛化 `helper.py`

## 6. API 与分页规则

- 新 app 的 router 定义在 `apps/<app>/api.py`，再接入 `config/api.py`
- 分页接口统一使用 `page`、`page_size`
- 分页返回统一使用 `{ items, total, page, page_size }`

## 7. 测试规则

- 后端测试放在 `tests/<app>/`
- 不在 `apps/<app>/tests/` 下建测试

## 8. 前后端联动规则

如果 `frontend_admin` 需要使用该 app 的接口：

- 先定义后端 schema 和 API
- 再通过 OpenAPI 生成前端客户端
- 不手改 `frontend_admin/src/services/openapi`

生成命令：

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin openapi
```

## 9. 权限与上下文

新增 app 前先判断是否应复用现有：

- 用户认证
- 组织上下文
- 团队体系

如果属于组织内业务，优先沿用现有组织和权限模型，不单独再造一套授权结构。
