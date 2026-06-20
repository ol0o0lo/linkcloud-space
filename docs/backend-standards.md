# 后端开发规范

## 1. 适用范围

本规范适用于所有后端 app，而不只是某一个业务模块。

新增或维护 `accounts`、`wallet`、`notifications`、`organizations`、`media` 等 app 时，都应优先遵守本文件中的分层、命名和返回约定。

## 2. 文件职责边界

`models.py`

- 定义 model、字段、约束
- 放少量与模型强绑定的方法
- 不承担复杂业务编排

`constants.py`

- 定义稳定复用的枚举、状态、类型、动作名
- 优先把展示文案直接收敛在枚举定义处

`schemas.py`

- 定义 API 输入输出
- 做只看请求体即可判断的静态校验
- 例如必填、类型、长度、枚举值、列表数量、字符串清洗

`services.py`

- 作为业务入口
- 负责数据库读写、状态流转、跨 app 协作和副作用
- 不把复杂业务逻辑堆进 `api.py`

`api.py`

- 定义 Ninja router
- 接参数、做鉴权入口、调用 service、返回结果
- 不承担大段业务编排

`utils.py`

- 只放纯函数工具
- 不查库、不写库、不写日志、不触发副作用

## 3. 分层规则

- schema 负责静态输入校验
- service 负责业务规则和副作用
- utils 只放纯工具
- 不新增泛化 `helper.py`
- 正常合理的架构设计不应该依赖局部导入来掩盖循环依赖问题
- 如果模块必须依赖局部导入才能工作，优先回头检查依赖方向和职责拆分是否合理

## 4. 枚举规范

- 枚举统一定义在 `constants.py`
- 不要在 `api.py`、`services.py`、前端分别维护多份字符串映射
- 枚举展示文案优先通过枚举类自身能力提供

## 5. 返回字段命名约定

- 返回值中保留枚举原始字段，例如 `status`、`source`
- 枚举值对应的展示文案统一使用 `__mapping` 后缀，例如 `status__mapping`、`source__mapping`
- 不再为新接口新增 `status_label`、`source_label` 这一类字段
- `__mapping` 字段只用于展示增强，不作为写入字段

## 6. API 与分页规则

- 新 app 的 router 定义在 `apps/<app>/api.py`，再接入 `config/api.py`
- 分页接口统一使用 `page`、`page_size`
- 分页返回统一使用 `{ items, total, page, page_size }`

## 7. 测试规则

- 后端测试放在 `tests/<app>/`
- 不在 `apps/<app>/tests/` 下建测试

## 8. 前后端联动规则

如果 `frontend_admin` 需要使用某个 app 的接口：

- 先定义后端 schema 和 API
- 再通过 OpenAPI 生成前端客户端
- 不手改 `frontend_admin/src/services/openapi`

生成命令：

```bash
source ~/.nvm/nvm.sh && nvm use 22 && pnpm --dir frontend_admin openapi
```

## 9. 组织与权限复用

新增或维护业务 app 时，先判断是否应复用现有：

- 用户认证
- 组织上下文
- 团队体系

如果属于组织内业务，优先沿用现有组织和权限模型，不单独再造一套授权结构。
