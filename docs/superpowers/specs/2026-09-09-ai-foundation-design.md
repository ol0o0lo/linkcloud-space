# 通用 AI 底座设计

## 1. 背景

链云空间已经具备房源、收藏、配房分享、预约带看、租约、通知、任务、经营分析、多租户和 Celery 等业务能力，但后端尚未形成统一的 AI 调用能力。

本设计在 Django 项目内新增独立的 `apps.ai` 应用，为后续自然语言找房、结构化信息提取、房源解读、经营简报等功能提供公共底座。业务应用不得直接调用模型供应商。

## 2. 设计目标

首期实现：

- 平台统一管理模型供应商、模型和能力路由；组织不接触供应商密钥。
- 支持 OpenAI、阿里云百炼、火山方舟等供应商。
- 支持普通文本生成、对话和结构化 JSON 输出。
- 支持 Prompt 模板、版本、启用状态和调用快照。
- 支持同步 JSON、SSE 流式响应和 Celery 异步执行。
- 记录调用状态、供应商、模型、Token、估算费用、耗时和标准化错误。
- 按调用类型实施分级内容保留。
- 所有调用携带用户、组织、来源业务和权限上下文。
- 提前接入限额执行生命周期，但首期使用永远放行的空策略。

## 3. 非目标

首期不实现：

- RAG、向量数据库和组织知识库。
- Agent、工具调用和自动执行业务操作。
- 组织自带供应商密钥。
- 按套餐、Token、请求次数或金额限制使用。
- 自动发布房源、修改租约、分配客户、签署合同或执行资金操作。
- 独立 AI 微服务、工作流 DSL、插件框架或依赖注入容器。
- 路由缓存、熔断器、定时健康探测、自动模型评测、Prompt 灰度实验和组织级模型路由。

AI 输出首期始终是内容、结构化结果或建议草稿。业务写入仍由原业务服务校验并执行。

## 4. 总体架构

新增应用结构：

```text
apps/ai/
├── __init__.py
├── apps.py
├── models.py
├── admin.py
├── schemas.py
├── api.py
├── tasks.py
├── services.py
├── migrations/
│   └── __init__.py
│
├── runtime/
│   ├── __init__.py
│   ├── contracts.py
│   ├── executor.py
│   ├── router.py
│   ├── prompts.py
│   ├── quota.py
│   ├── retention.py
│   └── providers/
│       ├── __init__.py
│       └── openai_compatible.py
```

依赖方向：

```text
api / tasks / house / analytics / notifications
                        │
                        ▼
                    services
                   ├── models
                   └── runtime.executor
                         ├── prompts
                         ├── router
                         ├── quota
                         ├── retention
                         └── providers
                               └── provider adapters
```

依赖规则：

- `services.py` 是 `apps.ai` 对其他应用提供的唯一公共接口。
- `api.py` 和 `tasks.py` 只能通过 `services.py` 发起执行。
- 其他业务应用不得直接导入 `runtime` 或 `providers`。
- `runtime` 不导入 `api.py`、`schemas.py`、`tasks.py` 或具体业务模型。
- `runtime.providers` 只依赖运行时契约和供应商 SDK，不依赖 Django 业务模型。
- `schemas.py` 只定义 HTTP 传输结构，不作为运行时内部契约。

## 5. 模块职责

### 5.1 `services.py`

`services.py` 是一个深模块，负责对调用方隐藏以下行为：

- 校验用户身份、组织关系、能力权限和请求范围。
- 创建或恢复幂等的 `AIInvocation`。
- 创建对话及消息记录。
- 为异步调用保存短期执行载荷。
- 调用 `runtime.executor`。
- 根据保留决策写入或清理调用内容。
- 将内部结果转换为稳定的业务返回值。

对业务应用提供的首期接口：

```python
generate(...)
stream(...)
enqueue(...)
get_job(...)
```

`generate()` 通过可选的 `response_model` 参数表达结构化输出，不再提供一套重复的 `generate_structured()` 流程。

`get_job()` 按用户、组织和来源业务查询异步调用状态及短期结果，避免业务模块直接读取 AI 数据模型。

调用方必须传入逻辑能力 `capability`，不得传入供应商 API Key、Base URL 或供应商专用参数。HTTP 客户端不得直接指定 Prompt key、capability 或模型生成参数。

### 5.2 `runtime/contracts.py`

定义供应商无关的内部契约：

- `AIExecutionContext`：用户、组织、来源应用、业务目标、幂等键和保留策略。
- `AIExecutionRequest`：能力、Prompt、变量、对话消息、结构化输出约束和执行模式。
- `AIExecutionResult`：文本、结构化数据、实际模型、Token、费用、结束原因和耗时。
- `AIStreamChunk`：流式文本增量、完成信息或错误事件。
- `AIUsage`：输入 Token、输出 Token、总 Token 和用量来源。
- `AIProviderError`：统一错误类型、是否可重试和供应商原始请求标识。
- `AIProvider`：Provider Protocol，定义普通生成和流式生成方法。

内部契约使用普通 Python 类型、dataclass 和 Pydantic，不依赖 Ninja Schema。

### 5.3 `runtime/executor.py`

负责一次调用的固定执行流水线：

```text
校验执行请求
→ 限额预检和预占
→ 解析并渲染 Prompt
→ 获取候选模型链
→ 调用 Provider
→ 校验普通或结构化输出
→ 生成内容保留决策
→ 生成调用结果与审计信息
→ 限额结算或释放
```

同步、流式和异步模式必须复用同一套路由、Provider、错误归一化、审计和保留规则，不得在入口层分别实现。

`executor` 不接收 `HttpRequest`，也不读取房源、租约、客户等业务表。

### 5.4 `runtime/router.py`

根据以下信息生成有序模型候选链：

- `capability`。
- 执行模式是否要求流式输出。
- 是否要求结构化输出。
- 模型与供应商是否启用。
- 模型是否支持流式或结构化输出等必要执行特性。
- 路由优先级。

业务模块只使用逻辑能力，例如：

```text
chat
text_generation
structured_extract
long_text
vision
```

首期路由由平台统一管理，不实现组织级模型路由。组织是否允许使用某项能力通过现有组织设置能力控制。

capability 使用代码内固定枚举，由 `runtime/contracts.py` 定义。新增 capability 需要经过代码评审和部署，Admin 不能创建任意字符串，避免配置拼写错误形成不可发现的路由。

只有超时、限流、供应商不可用、连接故障和平台配置故障允许尝试备用模型。输入错误、内容安全拒绝和结构化 Schema 错误不得通过切换模型掩盖。

流式调用仅允许在尚未向客户端发送首个内容片段时切换备用模型。已经输出部分内容后发生故障，应结束当前流并记录中断，避免拼接两个模型的输出。

### 5.5 `runtime/prompts.py`

负责：

- 按 `prompt_key` 和可选版本查询模板。
- 未指定版本时解析唯一启用版本。
- 校验必填变量。
- 使用 Django 已有模板能力渲染消息。
- 返回 Prompt key、版本、模板哈希和内存中的渲染消息。

Prompt 版本一旦产生调用记录便不可原地修改。修改内容必须创建新版本，再切换启用状态。

Prompt 渲染结果可能包含敏感业务数据，不因“生成快照”而默认永久保存。调用记录永久保存模板 key、版本和哈希；渲染正文是否持久化由 `retention.py` 决定。

首期保持单个 `runtime/prompts.py`。只有出现多个渲染器、独立缓存或显著增长后才拆为子包。

### 5.6 `runtime/quota.py`

采用策略模式和空对象模式，统一接口为：

```python
reserve(context, estimated_usage)
settle(reservation, actual_usage)
release(reservation)
```

首期启用 `UnlimitedQuotaPolicy`：

- 所有合法请求均通过。
- 不按次数、Token、金额或套餐拒绝请求。
- 仍创建逻辑预占并在结束时结算，以保证调用生命周期稳定。
- Token 和费用仍写入调用记录，为以后启用限额提供数据基础。

未来可增加组织、套餐、用户速率或预算策略，而不修改业务调用接口和执行流水线。

不限业务额度不等于取消系统安全上限。平台仍必须限制单次输入大小、最大输出 Token、超时时间、对话历史长度和最大流式时长，防止单个请求耗尽进程资源。

### 5.7 `runtime/retention.py`

负责根据能力、执行模式和显式策略生成内容保留决策，不负责业务权限判断。

首期支持：

- `conversation`：用户主动创建的对话消息正常保存。
- `temporary`：一次性业务调用的原始输入和输出保存到过期时间，之后清理正文。
- `metadata_only`：调用完成后不保留原始正文，只保留模板版本、模型、用量、哈希和允许的脱敏摘要。

脱敏摘要不得直接截取任意原文。优先使用业务调用方传入的允许字段，或对明确声明的结构化字段生成摘要。手机号、邮箱、证件号、密钥和访问令牌不得进入摘要。

### 5.8 `runtime/providers`

Provider seam 直接定义在 `runtime/contracts.py`：

```python
class AIProvider(Protocol):
    def generate(self, request) -> AIExecutionResult: ...
    def stream(self, request) -> Iterator[AIStreamChunk]: ...
```

`runtime/providers/openai_compatible.py` 使用同一个 OpenAI-compatible 实现承接 OpenAI、阿里云百炼、DeepSeek 和火山方舟，通过供应商配置中的 Base URL、密钥环境变量和模型名称区分。

首期只引入一个生产 Adapter。测试在测试代码中提供 Fake Adapter。只有某个供应商协议或返回语义确实不兼容时，才增加专用 Adapter 文件。

`runtime/providers/__init__.py` 保存一个最小 Adapter 映射和获取函数，不单独创建 `registry.py`：

```python
PROVIDERS = {
    "openai_compatible": OpenAICompatibleProvider,
}
```

该映射只根据 Provider adapter key 返回对应 Adapter，不承载路由、权限或重试逻辑。

建议新增官方 `openai` Python SDK，并统一使用供应商普遍兼容的 Chat Completions 协议，不使用 OpenAI 专属 Responses 或结构化解析接口。模型通过 `structured_output_mode` 声明 `none`、`json_object` 或 `json_schema`；结构化输出均由 Provider 获取原始 JSON，再交给本地 Pydantic 校验。

数据库迁移内置以下首期配置，部署后无需在 Admin 手工创建：

- 阿里云百炼：`qwen-plus`，密钥变量 `DASHSCOPE_API_KEY`。
- DeepSeek：`deepseek-chat`，密钥变量 `DEEPSEEK_API_KEY`。
- 两个模型均路由到 `chat`、`text_generation`、`structured_extract`、`long_text`，默认优先使用百炼，失败时按执行器规则降级到 DeepSeek。
- 两个模型使用 `json_object`，执行器补充 JSON Schema 指令，并继续使用本地 Pydantic 严格校验和一次修正。
- 内置启用的 `general.chat@1` Prompt；迁移不会覆盖管理员已经创建的同名供应商、模型、路由或 Prompt 配置。

启用时只需设置 `AI_ENABLED=true`，至少填写一个供应商 API Key，并执行 Django migration。未使用的供应商可以不配置密钥或在 Admin 中禁用。

关闭或严格限制 SDK 内部自动重试，由 `executor` 统一负责备用模型切换，避免 SDK、Celery 和执行器形成多层重试。

## 6. 数据模型

首期共保留七个模型：供应商、模型、路由、Prompt、对话、消息和调用记录。Provider 尝试明细与短期调用正文先内嵌在调用记录中，达到明确查询或性能瓶颈后再拆表。

### 6.1 `AIProviderConfig`

平台供应商配置：

- `code`：稳定唯一标识。
- `name`：显示名称。
- `adapter`：例如 `openai_compatible`。
- `base_url`：兼容接口地址。
- `api_key_env`：API Key 所在环境变量名，不保存明文密钥。
- `enabled`。
- `timeout_seconds`。
- `extra`：少量供应商级兼容参数。
- 创建、更新时间和操作者审计字段。

Admin 不展示环境变量真实值，只显示是否已配置。

### 6.2 `AIModel`

- `provider`。
- `model_name`：供应商实际模型名。
- `display_name`。
- `enabled`。
- `supports_streaming`。
- `supports_json_schema`。
- `context_window`。
- `max_output_tokens`。
- `default_parameters`：仅保存跨供应商通用参数。
- `input_price_per_million`。
- `output_price_per_million`。
- 货币和价格更新时间。

费用使用调用发生时的价格计算，并将价格快照写入调用记录。以后修改模型价格不得改变历史费用。

### 6.3 `AIModelRoute`

- `capability`。
- `model`。
- `priority`：数值越小优先级越高。
- `enabled`。

约束：

- 同一 capability 下模型不能重复。
- 同一 capability 和 priority 不能重复。
- 路由用于表达模型与 capability 的唯一映射，不再在 `AIModel` 重复维护 capabilities 列表。
- Router 根据请求模式检查模型的 streaming、JSON Schema 和上下文窗口等客观执行特性。

### 6.4 `AIPrompt`

首期使用单表版本模型：

- `key`。
- `version`。
- `name`。
- `capability`。
- `messages_template`：消息模板列表。
- `required_variables`：必填变量列表。
- `default_parameters`：允许覆盖的通用生成参数。
- `is_active`。
- `template_hash`。
- 创建、更新时间和操作者审计字段。

约束：

- `(key, version)` 唯一。
- 每个 key 最多一个启用版本。
- 已被调用记录引用的版本不得修改模板、变量和默认参数。

结构化输出 Schema 只由业务代码中的 Pydantic 模型定义，不在数据库保存第二份 JSON Schema，避免运行时契约与 Prompt 配置漂移。

模型参数优先级固定为：平台硬上限高于 Prompt 参数，Prompt 参数高于模型默认参数。最终值必须再次受模型自身上限约束。客户端不能直接覆盖 temperature、最大输出 Token 等参数。

### 6.5 `AIConversation`

- `organization`：可为空，支持个人空间对话。
- `owner`。
- `capability`。
- `title`。
- `status`：active、archived。
- `last_message_at`。
- 创建、更新时间。

组织对话必须校验 owner 仍属于组织并具有相应能力权限。个人对话不得携带其他组织的业务数据。

### 6.6 `AIMessage`

- `conversation`。
- `role`：system、user、assistant。
- `content`。
- `content_json`：可选结构化内容。
- `invocation`：助手消息对应的调用记录，可为空。
- `token_count`：供应商可提供时保存。
- 创建时间。

系统 Prompt 不必重复保存为每条可见消息；其版本和哈希由调用记录保存。

对话标题首期直接使用第一条用户消息的安全截断文本，不额外调用模型生成标题。

发送给模型的上下文按模型 context window 和平台消息数量上限选择最近消息。首期只裁剪最早的普通对话消息，不进行自动摘要，也不得裁剪当前用户消息和系统 Prompt。

### 6.7 `AIInvocation`

不可依赖原始正文长期存在的审计记录：

- `organization`：可为空。
- `actor`：系统任务可为空。
- `conversation`：可为空。
- `capability`。
- `source_app`。
- `target_type`、`target_id`。
- `execution_mode`：sync、stream、async。
- `status`：queued、running、succeeded、failed、interrupted。
- `idempotency_key`。
- `prompt_key`、`prompt_version`、`prompt_hash`。
- 实际 `provider_code`、`model_name`。
- 输入、输出和总 Token。
- 用量状态：reported、unavailable。
- 输入、输出价格快照和估算费用。
- 开始、结束时间和耗时。
- 标准化错误类型、错误码、安全错误摘要。
- 供应商请求标识。
- `retention_policy`。
- 内容哈希和允许的脱敏摘要。
- `attempts`：每次 Provider 尝试的有序 JSON 列表。
- `input_payload`、`output_payload`：按保留策略保存的可清理正文。
- `content_expires_at`：正文清理时间。

缺失的供应商 Token 用量必须记录为 unavailable，不得当作零用量，也不使用不可靠的字符数估算冒充供应商数据。

`AIInvocation` 保存整个逻辑调用的最终状态和最终采用的供应商、模型。主模型失败、备用模型成功时，每次实际供应商请求按顺序追加到 `attempts`：

```json
[
  {
    "sequence": 1,
    "provider": "openai",
    "model": "primary-model",
    "status": "failed",
    "error_type": "timeout",
    "duration_ms": 30000
  },
  {
    "sequence": 2,
    "provider": "bailian",
    "model": "fallback-model",
    "status": "succeeded",
    "input_tokens": 120,
    "output_tokens": 300,
    "estimated_cost": "0.0123"
  }
]
```

`AIInvocation` 的 Token 和费用是 attempts 中所有可获得用量的汇总，不只统计最终成功模型。无法获得的失败尝试必须保持 unavailable，不能按零费用处理。

异步任务只向 Celery 传递 `invocation_id`。任务所需输入暂存在 `input_payload`，避免把敏感 Prompt 直接作为 Celery 参数写入 Redis。任务完成后按保留策略清空正文或设置 `content_expires_at`。

对话调用不在 `AIInvocation` 重复保存完整消息正文，消息正文以 `AIMessage` 为唯一事实来源。

异步调用若需要客户端或业务方读取生成结果，`output_payload` 必须至少保存到消费完成或结果交付期限到期。`metadata_only` 仅适用于 Worker 在同一任务内已将结果写回业务模型的 fire-and-forget 场景；面向客户端查询的异步结果统一按 temporary 策略短期保存。

Admin 列表和普通审计查询必须 defer `input_payload`、`output_payload` 等大字段。只有正文体量实际影响调用表性能时，才拆出独立内容模型；只有需要频繁按每次尝试做 SQL 聚合时，才拆出独立尝试模型。

## 7. 执行流程

### 7.1 同步调用

1. 业务服务完成自身业务数据读取权限校验。
2. 调用 `apps.ai.services.generate()`，需要结构化结果时传入 `response_model`。
3. AI 服务再次校验用户、组织关系、能力开关和载荷安全上限。
4. 创建 running 状态调用记录。
5. Executor 执行限额、Prompt、路由和 Provider 流程。
6. 普通输出直接返回；结构化输出由本地 Pydantic 模型校验，并根据模型能力使用 `json_object` 或 `json_schema` 供应商请求格式。
7. 更新调用状态、Token、费用、耗时和保留内容。

### 7.2 SSE 流式调用

使用 POST 请求和 `text/event-stream` 响应，前端通过 Fetch 流读取，不依赖只能发起 GET 的原生 EventSource。

事件类型：

```text
start   调用 ID、模型显示信息
delta   文本增量
usage   最终 Token 信息，供应商支持时发送
done    完成状态和结束原因
error   安全错误码和可展示信息
```

要求：

- 在开始流式输出前创建调用记录。
- 不在长时间数据库事务内执行网络流。
- 文本片段只在进程内聚合，不按 chunk 写数据库；完成后一次性保存 assistant 消息。
- 流生成器的 `finally` 必须处理客户端断开、调用中断、限额释放和审计落库。
- 不向客户端发送供应商原始异常、API Key、Base URL 或完整请求体。
- 首期不支持 `Last-Event-ID` 续传；断线重试会创建新调用。

当前生产环境使用 gunicorn。首期使用 gthread worker 承载 SSE，并显式配置线程数、请求超时和反向代理关闭流式响应缓冲；不为首期 SSE 迁移整个项目到 ASGI。规模增长后再评估 ASGI 或独立流式网关。

### 7.3 异步调用

1. `enqueue()` 创建 queued 状态调用记录和短期内容记录。
2. Celery 仅接收 `invocation_id`。
3. Worker 通过带 `status=queued` 条件的数据库更新原子领取调用并转为 running。
4. 同一调用不得被两个 Worker 重复执行。
5. 执行成功或失败后更新结果和审计字段。
6. 对应业务接口通过 `services.get_job()` 获取状态和短期结果。

Executor 是模型调用重试的唯一所有者。Celery 不对已经进入供应商调用阶段的任务做透明自动重试，避免重复计费和重复生成。

## 8. 结构化输出

结构化调用支持：

- 业务代码传入 Pydantic Schema。
- Router 优先选择原生支持 JSON Schema 的模型。
- Provider 不使用供应商专属的自动解析对象；它返回原始 JSON，再由本地 Pydantic 验证。
- 模型不支持原生 JSON Schema 时，可以使用 JSON 模式并在本地验证，但 Router 必须明确知道该模型的能力等级。

输出验证失败时最多允许一次明确的修正尝试，且必须记入同一调用记录的尝试次数。仍失败则返回统一的结构化输出错误，不把未经验证的 JSON 交给业务层。

业务层收到结构化结果后仍需执行领域校验。例如 AI 提取出的租金、日期和房源状态不能绕过 `apps.house` 的 Schema、模型和服务校验。

## 9. 权限与多租户

- AI 调用必须有已认证用户，或明确标记为可信系统任务。
- 所有入口首先检查平台级 `AI_ENABLED` 紧急开关；关闭时不得创建新的供应商调用。
- 组织调用必须携带组织并验证当前用户仍属于组织。
- 其他业务应用只能把调用方本来有权读取的数据传入 AI。
- AI 模块不接受模型生成的任意 ORM 查询条件，也不自行探索业务表。
- 组织允许使用的 capability 通过现有 `apps.settings` 组织设置保存。
- 首期默认可开启全部配置能力，但保留组织级能力开关。
- 对话、消息、调用记录和任务查询必须同时按用户与组织范围过滤。
- 平台管理员可以查看元数据；原始内容默认隐藏并使用更严格权限。

建议新增权限语义：

```text
ai.use
ai.view_own_history
ai.view_org_audit
ai.manage_prompts
ai.manage_models
```

平台级供应商与模型配置仅允许 Django superuser 或等价平台管理员操作。

## 10. 敏感信息与内容保留

- API Key 只从环境变量读取，禁止写入数据库、调用记录或应用日志。
- Provider 请求和响应正文不得进入普通日志。
- 错误日志只记录 invocation ID、供应商、模型、错误类型和安全摘要。
- Prompt 变量必须设置总大小限制。
- 客户端不得直接提交供应商专用参数、Base URL 或任意最大 Token。
- `metadata_only` 调用完成后立即移除原始输入输出。
- `temporary` 内容由 Celery 定时任务将过期的 input/output payload 清空。
- `conversation` 内容按用户对话保留，并提供后续归档与清理入口。

AI 首期没有工具调用能力，因此 Prompt injection 不能触发数据库写入或外部业务操作。未来引入 Agent 时必须另行设计工具授权、参数校验和人工确认。

## 11. 错误、重试与降级

标准错误类别：

```text
invalid_request
permission_denied
capability_unavailable
provider_auth_error
rate_limited
timeout
provider_unavailable
content_rejected
structured_output_invalid
stream_interrupted
internal_error
```

错误处理原则：

- Provider Adapter 将供应商异常转换为统一错误。
- 只对明确可重试错误尝试备用模型。
- Provider SDK 内部自动重试最多一次或关闭。
- Executor 对每个候选模型最多尝试一次，避免重试倍增。
- 内容安全拒绝、非法输入和 Schema 错误不自动切换模型。
- 流式输出已经发送内容后不切换模型。
- 返回给用户的错误不包含供应商敏感信息。

## 12. HTTP 接口

建议挂载在 `/api/ai/`：

```text
POST /conversations/                    创建对话
GET  /conversations/                    查询本人对话
GET  /conversations/{id}/messages/      查询消息
POST /conversations/{id}/messages/      普通对话生成
POST /conversations/{id}/messages/stream/ 流式对话生成
```

`apps.ai` 不提供让客户端自由选择 Prompt、capability 和参数的通用生成接口。对话接口固定使用平台配置的 chat 能力和 Prompt。

房源提取、经营简报等能力通过对应业务应用接口暴露，业务接口内部调用 `apps.ai.services.generate()`、`stream()` 或 `enqueue()`。异步状态和结果也由对应业务接口按其权限语义提供，不暴露通用 invocation 查询入口。

## 13. Django Admin

Admin 首期提供：

- 供应商配置和启停。
- 模型、能力、价格和安全上限配置。
- 能力路由及优先级管理。
- Prompt 版本创建、启用、停用和只读历史。
- 调用记录、attempts、错误、Token、费用和耗时的只读查询。
- 对话与消息的严格权限只读排查入口。

Admin 校验：

- API Key 环境变量是否存在，但不显示值。
- 路由模型是否支持请求所需的流式、JSON Schema 和上下文窗口等执行特性。
- 每个 Prompt key 是否只有一个启用版本。
- 启用的 capability 是否至少存在一个有效模型路由。
- 已使用 Prompt 版本是否保持不可变。

## 14. 可观测性

首期记录：

- 成功率和标准错误类型。
- 供应商及模型调用次数。
- 输入、输出和总 Token。
- 估算费用和价格快照。
- 首 Token 延迟、总耗时和流式中断。
- 主模型失败后切换备用模型的次数。
- 结构化输出验证失败次数。
- 所有 Provider 尝试汇总后的真实调用费用。

调用日志以 `invocation_id` 贯穿 API、Celery、Provider 和业务日志。不得使用原始 Prompt 作为日志检索字段。

## 15. 测试策略

首期保留少量但覆盖关键 seam 的测试：

- Fake Provider 的 Adapter 契约测试。
- 普通、结构化、流式三种执行模式共享路由和审计逻辑。
- 主模型失败后只对可重试错误切换备用模型。
- 流式首个片段前允许降级，输出后禁止拼接模型。
- `UnlimitedQuotaPolicy` 确实经过 reserve、settle 和 release 生命周期。
- Prompt 启用版本唯一和已使用版本不可变。
- 结构化输出不会把未验证数据交给调用方。
- 组织、用户、对话和调用记录不存在越权读取。
- temporary 和 metadata_only payload 按策略清理。
- 异步任务只凭 invocation ID 执行且不会重复领取。
- SSE 事件顺序和断开后的 interrupted 状态。

不为简单 Django Admin 展示和纯字段映射编写大量低价值测试。

## 16. 实施顺序

建议按以下顺序实施，每一步均保持可运行：

1. 建立应用、配置模型、Provider 契约、OpenAI-compatible Adapter、Fake Adapter 和 `UnlimitedQuotaPolicy`。
2. 完成 Prompt、Router、同步 generate、调用审计、attempts 记录和 Admin。
3. 增加结构化输出及验证。
4. 增加对话、消息和 SSE。
5. 增加 Celery 异步调用和内容清理任务。
6. 接入组织 capability 开关并完善运营指标。
7. 选择一个低风险租房场景作为首个消费者，例如房源公开描述草稿或结构化信息提取。

首个业务消费者用于验证底座，不把业务特例写入 `apps.ai`。

## 17. 验收标准

- 其他业务应用不直接引用供应商 SDK。
- 外部调用方只能通过 `generate()`、`stream()`、`enqueue()` 和 `get_job()` 四个公共方法使用底座。
- 平台管理员可以配置供应商、模型、路由和 Prompt 版本。
- 同一业务调用代码不因切换 OpenAI、百炼、DeepSeek 或火山而改变。
- 普通 JSON、结构化输出、SSE 和 Celery 均使用同一 Executor 流水线。
- 调用记录包含实际供应商、模型、状态、Token、费用、耗时和安全错误信息。
- 对话消息与一次性业务调用执行不同的内容保留策略。
- 首期调用不受业务额度限制，但每次调用均经过限额生命周期。
- 任何 AI 结果都不能绕过现有业务权限、Schema、服务和状态转换。
- 供应商故障不会泄露密钥、原始异常或其他组织的数据。
- AI 不可用时，现有非 AI 租房业务仍可正常使用。
- 关闭 `AI_ENABLED` 后不会创建新的供应商请求，已有非 AI 功能保持可用。
