# 租户隔离的通用 IM 基础能力：技术设计与实施计划

日期：2026-10-24

状态：通用后端与小程序/H5、管理端入口已实现；房源详情的发送联系方式已接入真实聊天记录和聊天通知。本地已应用 messaging.0001_initial；微信仅完成构建，真机验收待进行。具体回归和浏览器验收记录见第 16 节。

**目标**：建设独立、业务无关的 apps.messaging，为各业务提供租户隔离的会话、参与人、文字消息、未读和轮询能力。房产、车辆或其他业务通过稳定接口接入，在首期文字单聊能力范围内不需要修改聊天核心。

**架构**：通用聊天核心、平台集成、业务适配分别组织。核心只理解租户、用户、参与资格、业务命名空间及不透明关联键；业务适配负责资源权限、参与人选择和业务生命周期；通用客户端只调用聊天接口。现有通知是可选补充提醒，HTTP 轮询是首期消息获取方式。

**技术栈**：现有 Django 5、django-ninja、PostgreSQL、allauth 认证；小程序/H5 沿用 uni-app、Vue 3、现有请求适配层；管理端使用 Umi、React、Ant Design 和 Ant Design X 的 Conversations、Bubble.List、Sender、Welcome。首期不增加独立服务。

实施时逐项完成文末任务。遵循根目录及子目录 AGENTS.md；本计划不授权 Git 操作、破坏性清理、数据库恢复或发布。

## 1. 已确认的需求和首期范围

### 1.1 必须完成

1. apps.messaging 是项目的通用 IM 基础能力，不以房源咨询、车辆咨询或某个业务的角色名称建立模型和权限规则。
2. 每个会话必须归属一个组织 Organization；不同租户的会话、消息、阅读位置与统计完全独立。
3. 支持组织成员单聊和经业务授权的外部参与人单聊。单聊可以是两名组织成员、一名组织成员与一名外部参与人，或两名经同一租户业务授权的外部参与人。
4. 支持会话列表、最后消息摘要、历史分页、增量消息查询和个人未读数。
5. 支持并发发送、服务端消息顺序和失败重试幂等。
6. 已读状态由会话参与人持有，不借用通知 read_at。
7. 新业务只需要决定租户、业务命名空间、会话复用键、关联对象键和参与人，随后调用公共聊天服务。
8. 通用模型、HTTP 接口和前端聊天逻辑不导入房产、车辆等具体业务模型、接口或页面。
9. 小程序/H5 与管理端共用同一套后端消息和已读状态；业务入口只负责创建会话并打开通用聊天页。

### 1.2 首期边界

首期为租户隔离的文字单聊，不实现群聊、音视频、文件、在线状态、正在输入、撤回、全文搜索或客服自动分配。

通用底座先完成独立验证，随后接入现有房源咨询作为首个业务示例。车辆仅用于说明接口与验收通用性，本次不创建车辆业务 app、表、页面或接口。

组织 owner 和超级管理员通过普通聊天接口时，同样必须是有效参与人，不默认拥有查看所有聊天的权限。

“业务无关”保留项目现有 User、Organization、认证与 HTTP 基础设施。接入其他业务不改核心；如果新增群聊或新的消息类型，那属于聊天能力自身的扩展。

## 2. 当前代码事实与接入约束

| 位置 | 当前能力 | 对本方案的影响 |
| --- | --- | --- |
| apps/notifications/models.py | 包含 recipient、actor、body、data、read_at | 可提供补充提醒，不能作为聊天事实来源 |
| apps/notifications/services.py | notify() 要求组织通知接收人属于 OrganizationMember | 集成层保留此规则；外部参与人的聊天未读独立计算 |
| apps/notifications/managers.py | 合并当前组织与 organization 为空的通知 | 聊天不能沿用该查询 |
| apps/notifications/tasks.py | 通知存在保留期清理任务，默认设置 90 天 | 聊天独立存储，实际通知保留期以运行环境为准 |
| apps/organizations/session.py | X-Org-Slug 仅认可真实组织成员 | 外部参与人使用持久化会话授权，不伪装为组织成员 |
| apps/base/ninja_pagination.py | page、page_size 和最小分页结构 | 核心所有列表继续采用该契约 |
| apps/accounts/services.py | 轻量账号合并会检查业务身份 | 平台集成补充聊天身份检查，避免历史失联 |
| frontend_miniprogram/src/infra/http/request-scope.ts | 显式 personal、landlord、organization 作用域 | 复用认证与请求适配，不把业务角色写进聊天请求层 |
| frontend_miniprogram/src/domain/route-access.ts | 根据组织上下文处理身份切换 | 个人业务会话的资源租户与组织成员模式必须区分 |
| config/asgi.py、apps/ai/api.py | 标准 Django ASGI；AI 对话另有 SSE | 没有可直接复用的用户间 IM 通道 |

首个房源适配可以复用 apps.house 的公开房源查询、resolve_contact_recipient() 和现有联系入口；这些只是业务适配可用的现有能力，不成为 messaging 的依赖。

相关现有约定：

- [业务工作流与通知协作设计](../../business-workflow-notification-design.md)
- [后端开发规范](../../backend-standards.md)
- [小程序上下文与 API 契约](../../miniprogram-context-api-contract.md)
- [前端工程结构](../../frontend-structure.md)

以上来自当前工作区静态核查，不代表生产配置或运行效果已验证。

## 3. 模块划分、依赖方向与公共接口

### 3.1 三部分职责

~~~mermaid
flowchart LR
    HOUSE[房产业务适配] --> CORE[通用 messaging 服务]
    VEHICLE[车辆业务适配示例] --> CORE
    OTHER[其他业务适配] --> CORE
    UI[通用聊天页面] --> API[通用聊天 HTTP 接口]
    API --> CORE
    CORE --> PLATFORM[现有用户 / 租户 / 认证]
    CORE --> DB[会话 / 参与人 / 消息]
    CORE --> NOTICE[可选通知集成]
    NOTICE --> NOTIFICATIONS[现有 notifications]
~~~

| 部分 | 负责 | 依赖规则 |
| --- | --- | --- |
| 通用聊天核心 | 租户归属、参与资格、会话复用、收发、顺序、幂等、已读、未读 | 可以依赖 accounts.models、organizations 和 base；不得导入具体业务 |
| 平台集成 | 补充通知、账号生命周期兼容、HTTP 接口挂载 | 只使用通用聊天对象和现有平台能力 |
| 业务适配 | 判断资源可见性、选择参与人、业务会话键、业务失效后的关闭/撤权 | 业务调用 messaging 公共服务，messaging 不反向调用业务 |
| 通用客户端 | 聊天列表、收发、轮询、阅读位置、租户状态隔离 | 不根据 namespace 分支调用不同业务 API |
| 业务前端入口 | 发起该业务会话、展示业务自身资源、打开通用聊天页 | 不自行维护消息、未读或轮询 |

### 3.2 公共契约

在 apps/messaging/contracts.py 定义简单的服务输入类型，避免使用房源角色或 HTTP Schema 作为内部参数：

~~~python
from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class ParticipantSpec:
    user_id: int
    access_kind: Literal["organization_member", "business_party"]
~~~

此处为公共服务输入契约，不接受客户端直接创建这些授权记录。

apps/messaging/services.py 对业务模块开放：

~~~python
get_or_create_conversation(
    *, actor, organization, namespace, conversation_key,
    participants: Sequence[ParticipantSpec], context_key=""
)
get_or_create_direct_conversation(*, actor, organization, peer_user_id)
list_direct_peers(*, actor, organization, keyword="")
list_personal_organizations(*, actor)
list_conversations(*, actor, organization, access_kind, namespace=None)
get_conversation(*, actor, organization, access_kind, conversation_id)
list_messages(
    *, actor, organization, access_kind, conversation_id,
    before_seq=None, after_seq=None
)
send_message(
    *, actor, organization, access_kind, conversation_id,
    client_message_id, content
)
find_sent_message(
    *, actor, organization, access_kind, namespace,
    context_key, client_message_id
)
mark_read(*, actor, organization, access_kind, conversation_id, last_read_seq)
get_unread_counts(*, actor, organization, access_kind, namespace=None)
revoke_participant(*, organization, conversation_id, user_id)
close_context_conversations(*, organization, namespace, context_key)
user_has_messaging_history(*, user)
~~~

以上公共接口已在 apps/messaging/services.py 实现；调用签名与返回值以代码为准。

- get_or_create_conversation() 供已完成资源和业务授权的服务调用，不作为任意客户端可调用的通用外部建群接口。
- 调用者传入的 actor 必须是两个参与账号之一；两个账号必须不同且启用。
- organization_member 必须在当前组织拥有真实成员资格；business_party 必须由受信任业务入口明确授权，不能由 HTTP 请求体自行指定。
- 核心不假定 actor 是买方、对方是客服，参与人顺序也不表达业务角色。
- 组织内单聊的包装函数使用保留命名空间 im.direct，并由核心生成规范用户对键。凡是使用 im.direct 的创建调用，核心都要求两个真实组织成员、规范用户对键和空 context_key，不能借通用入口改变保留会话的授权方式。
- 外部参与会话使用业务自己的命名空间与会话复用键；核心只做合法性、唯一性与既有参与集合一致性检查。
- close_context_conversations() 必须同时限定组织、命名空间和非空关联键；不能跨业务关闭同名资源。
- find_sent_message() 供业务入口恢复已提交消息，范围包括租户、命名空间、关联键、本人发送身份及当前会话访问资格；不读取具体业务对象。
- 读取服务返回可分页 QuerySet 或明确结果对象，HTTP schema 不成为业务内部依赖。

不建立业务插件注册中心、动态模型加载器或事件总线。命名空间和不透明键已经足够支持已讨论的多业务接入。

## 4. 数据模型

保留 Conversation、ConversationMember、Message 三张表，沿用 CreateUpdateTimeModelMixin 和项目常用整数主键。通用性主要通过调整 Conversation 的业务定位契约实现，不为每种业务增加聊天表。

### 4.1 Conversation

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| organization | FK，必填 | 唯一租户归属，创建后不可修改 |
| namespace | CharField(64) | 业务命名空间；只把 im.direct 作为核心保留值 |
| conversation_key | CharField(192) | 命名空间内的会话复用键，由受信任服务提供 |
| context_key | CharField(128)，允许空字符串 | 业务对象关联键，统一为字符串，可表示整数、UUID、订单号或组合键 |
| status | active / closed | 控制是否允许继续发送 |
| last_message_seq | PositiveBigInteger，默认 0 | 会话最后一个已提交消息顺序号 |
| last_message | FK Message，可空 | 读取最后消息摘要 |
| last_message_at | DateTime，可空 | 会话列表排序 |

约束与索引：

- UniqueConstraint(organization, namespace, conversation_key)。
- 列表索引：(organization, -last_message_at, -id)。
- 业务定位索引：(organization, namespace, context_key)。
- namespace、conversation_key、context_key 及 organization 在创建后保持不变。
- namespace 不使用包含 house、car、order 等业务枚举的固定 choices；采用长度及命名格式校验，例如小写字母、数字、下划线和点分段。
- conversation_key 与 context_key 作为不透明字符串保存和比较，不做整数转换、角色拆解或业务模型查询。
- last_message 必须属于本会话；由统一发送服务维护。
- 空会话 seq 为 0，排序使用 last_message_at 降序、空值最后，再按 id 降序。

### 4.2 会话定位示例

下表是业务适配如何使用通用字段的示例，不是 messaging 中的枚举或分支：

| 业务 | namespace | context_key | conversation_key 由谁确定 |
| --- | --- | --- | --- |
| 组织成员单聊 | im.direct | 空字符串 | 核心根据排序后的两个用户 ID 生成 |
| 房产咨询 | real_estate.inquiry | listing:123 | 房产业务根据房源、客户与接待人确定 |
| 车辆咨询 | vehicles.inquiry | vehicle:550e8400-e29b-41d4-a716-446655440000 | 车辆业务根据车辆与沟通双方确定 |
| 订单沟通 | commerce.order | order:SO20261024001 | 订单业务根据订单与参与人确定 |

同一组织下，两个业务可以使用相同 conversation_key 或 context_key，因为 namespace 不同。不同组织即使所有字符串均相同，也仍是独立会话。

具体业务决定“同一对用户是否因不同资源建立不同会话”；核心不内置“每个房源一个会话”或“同一买家与卖家总是一个会话”的规则。

context_key 不是外键。业务资源删除、售出、下架或完成时是否关闭会话，由业务调用公共关闭或撤权服务，核心不自动推断。

### 4.3 ConversationMember

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| conversation | FK Conversation | 从会话继承租户与业务归属 |
| user | FK User，可空，SET_NULL | 当前参与账号；账号删除时保留历史记录 |
| display_name_snapshot | CharField(150) | 原账号不存在时展示历史名称 |
| access_kind | organization_member / business_party | 通用授权方式，不是买家、卖家、租客或中介角色 |
| last_read_seq | PositiveBigInteger，默认 0 | 已阅读到的消息位置 |
| revoked_at | DateTime，可空 | 受信任业务服务显式撤销参与资格 |

- user 非空时，唯一约束为 (conversation, user)。
- 索引：(user, access_kind, conversation)。
- 创建事务生成两个不同账号的参与记录，首期不开放普通用户增删成员。
- access_kind 由服务端决定，创建后不因切换前端身份而改变。
- organization_member 每次访问重新校验组织成员资格。
- business_party 依靠该会话的持久化业务授权，可由业务显式撤销。
- 两名 business_party 可以在同一个租户会话中沟通，核心不强制至少一人是组织员工。
- 业务角色如买家、卖家、顾问留在业务模块，不进入核心授权判断或固定枚举。

### 4.4 Message

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| conversation | FK Conversation | 会话、租户与命名空间归属 |
| sender_member | FK ConversationMember，RESTRICT | 历史发送参与人 |
| seq | PositiveBigInteger | 会话内递增顺序号，从 1 开始 |
| client_message_id | UUID | 客户端首次生成，重试复用 |
| content | TextField | 纯文字，规范化后 1～2000 字符 |
| created_at | 服务端时间 | 展示时间，不用作可靠顺序 |

- UniqueConstraint(conversation, seq)。
- CheckConstraint(seq >= 1)。
- UniqueConstraint(conversation, sender_member, client_message_id)。
- sender_member.conversation 必须等于当前会话，统一服务校验。
- (conversation, seq) 的唯一索引用于历史和增量查询，不增加重复索引。
- 不复制 organization、namespace、业务角色或业务对象 ID 到每条消息。
- 只规范换行和首尾空白，客户端按纯文本渲染，不把业务卡片混入首期文字正文。

### 4.5 保留和生命周期

- 聊天历史与通知保留期独立，首期不提供用户删除消息、清空记录或自动清理。
- 业务资源的下架、删除、完成等动作本身不触发核心级联删除；相应业务决定是否关闭会话。
- 用户停用、组织成员移除或参与资格撤销后，后续请求失去对应权限，历史仍保留。
- 账号实际删除时，参与人 user 置空，消息继续引用保留的参与记录。
- sender_member 使用 RESTRICT 防止单独删除有历史的参与记录；租户或会话整体删除时需验证 Django 级联收集行为。
- 租户实际删除遵循项目租户生命周期，本计划不执行此类操作。

## 5. 租户、参与资格和业务隔离

### 5.1 访问不变量

任何会话、消息、已读和统计请求必须满足：

~~~text
用户已认证且启用
AND 明确指定的组织真实存在且启用
AND 会话.organization_id == 本次组织.id
AND 本人存在未撤销的参与记录
AND access_kind 与本次请求模式匹配
AND 若为 organization_member，当前组织成员资格仍有效
~~~

不提供无租户范围的全局消息查询，不回退 Session 的旧组织，也不合并 organization 为空的个人通知。

namespace 表示业务范围，不取代租户或参与鉴权；知道 namespace、context_key 或会话 ID 都不能取得访问权限。owner、超级管理员没有普通聊天内容的默认绕过权限。

### 5.2 请求模式

通用资源路径显式携带组织：

~~~text
/api/messaging/organizations/{organization_slug}/...
~~~

| 模式 | 请求头 | 授权方式 |
| --- | --- | --- |
| 组织成员会话 | 认证信息 + X-Org-Slug | 请求头与 URL 相同，当前组织成员资格及 organization_member 参与记录均有效 |
| 外部业务会话 | 认证信息，不带 X-Org-Slug | 用 URL 定位组织，校验本人有效 business_party 参与记录 |

- 有组织头的请求进入组织成员模式，失败后不回退外部模式。
- 无组织头只查外部参与会话，不借 Session 中的组织访问内部参与记录。
- 两名外部参与人分别使用个人请求作用域访问自己的同一会话。
- 用户、发送人、参与类型和组织归属不能由消息请求体指定。
- 会话、历史、增量、阅读位置与统计共用资格查询。
- 跨租户 ID、未知会话及无资格访问统一返回 404，不泄露资源是否存在。
- namespace 筛选只能缩小已经授权的列表和统计，不能改变参与资格。

### 5.3 外部参与人的组织选择

个人组织发现接口只返回本人具有有效 business_party 会话的组织，不返回全站目录。

每条结果提供组织名称、slug 和该组织未读数；列表一次只选择一个组织。不混排跨租户会话，不计算跨租户聊天未读总计。

只有一个可选组织时自动选择；多个时由用户选择并记住最近有效选择。任意业务创建会话成功后，可直接进入返回的组织与会话，无需把用户加入组织。

### 5.4 参与和状态变化

| 变化 | 通用行为 |
| --- | --- |
| 组织成员移除 | 该成员后续读写均被拒绝，其他有效参与人可看自己的历史 |
| 对方账号停用、员工资格失效或参与授权撤销 | 当前有效参与人仍可看历史，can_send=false，不新增消息 |
| 业务希望更换接待、交易对手或沟通双方 | 由业务决定新的会话键；核心不自动转移旧历史 |
| 业务资源下架、售出、删除或完成 | 核心不检查业务状态；业务决定是否调用关闭/撤权服务 |
| 会话关闭 | 有效参与人可查看历史，发送返回关闭错误 |
| 组织归档/停用 | 该组织聊天不可访问 |

后续请求检查数据库当前资格；不承诺取消已经完成授权并提交的历史请求。

## 6. 通用 HTTP 接口契约

统一挂载现有 NinjaAPI，复用 Session、Bearer、X-Session-Token 认证、响应信封与异常处理。核心 URL 不包含 house、vehicle、订单或任何业务资源类型。

以下示例表示业务数据部分，实际 HTTP 响应继续使用项目现有信封。

### 6.1 接口清单

B 表示 /api/messaging/organizations/{organization_slug}。

| 方法 | 路径 | 请求/筛选 | 返回 |
| --- | --- | --- | --- |
| GET | /api/messaging/personal/organizations/ | page、page_size、可选 namespace；禁止组织头 | 本人外部参与的组织和分组织未读 |
| GET | B/peers/ | keyword、page、page_size；仅组织模式 | 当前组织可发起单聊的启用成员 |
| POST | B/conversations/direct/ | peer_user_id；仅组织模式 | 创建/复用 im.direct 单聊 |
| GET | B/conversations/ | page、page_size、可选 namespace | 当前组织与模式下本人会话 |
| GET | B/conversations/{id}/ | 无 | 通用会话、参与人、阅读位置、can_send |
| GET | B/conversations/{id}/messages/ | page、page_size、before_seq 或 after_seq | 历史/增量消息 |
| POST | B/conversations/{id}/messages/ | client_message_id、content | 已持久化服务端消息 |
| PATCH | B/conversations/{id}/read/ | last_read_seq | 本人阅读位置及剩余未读 |
| GET | B/unread-count/ | 可选 namespace | 当前组织与模式的消息未读和未读会话数 |

外部业务创建会话由各业务自己的入口负责。通用 API 不开放“客户端传业务对象、任意参与人、access_kind 就创建会话”的接口。

消息/会话 ID 必须与路径组织共同查询。peers 仅返回当前组织其他启用成员的 user_id、名称、头像，不暴露手机号、邮箱、权限或其他组织账号。

### 6.2 分页和 namespace 筛选

所有分页路由声明 response=list[对应 Schema]，派生项目 LegacyPagination，默认 20、最大 100；消息页显式传 page_size=50。

~~~json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 50
}
~~~

namespace 不传时显示该租户中本人当前模式下全部业务会话；业务专用列表可以传入固定命名空间。列表、组织发现和未读统计采用一致的筛选语义，不把 namespace 当权限参数。

before_seq、after_seq 是消息位置筛选，不替代 page/page_size，不增加 cursor、next、has_more 顶层字段。

### 6.3 历史和增量

| 查询 | 服务端顺序 | 客户端使用 |
| --- | --- | --- |
| 未传位置 | seq 降序 | 首次最近 50 条，展示时转为升序 |
| before_seq=N | seq < N，降序 | 当前最小 seq，page=1，补更早历史 |
| after_seq=N | seq > N，升序 | 已接收最大 seq，page=1，补新消息 |

- before_seq、after_seq 互斥，非法组合返回 400。
- before_seq 为正数，after_seq 允许 0；不接受负数。
- total 是本次授权及筛选范围的条数。
- 增量超过一页时，用每批最大 seq 继续补取，直到为空或不足 page_size。
- 不用客户端时间或全局 Message.id 推进增量。
- 不在追加中的消息集合上使用递增 page 偏移补增量。
- 首期不删除历史消息，seq 的稳定性用于分页、去重和补取。

### 6.4 通用返回字段

ConversationOut：

~~~text
id
organization: { id, slug, name }
namespace
context_key
status / status__mapping
members: [{ id, user_id, display_name, avatar_url, access_kind }]
last_message: { id, seq, sender_member_id, preview, created_at } | null
my_member_id
my_last_read_seq
unread_count
can_send
send_block_reason / send_block_reason__mapping
~~~

namespace 与 context_key 是机器使用的业务定位信息，不作为页面直接展示的业务文案。核心不返回 house_id、car_id、买家/卖家等固定业务字段，也不在 schema 中列举业务 namespace。

MessageOut：

~~~json
{
  "id": 305,
  "conversation_id": 21,
  "seq": 8,
  "sender_member_id": 41,
  "client_message_id": "c4384140-5829-4f5c-8800-a78e60111e40",
  "content": "你好，方便沟通一下吗？",
  "created_at": "2026-10-24T08:30:00Z"
}
~~~

UnreadCountOut：

~~~json
{
  "message_count": 4,
  "conversation_count": 2
}
~~~

首次新增消息返回 201；同 UUID、同规范化正文的幂等重放返回 200 和同一条 Message。成功表示服务端保存，不代表对方在线或已读。

### 6.5 错误

| HTTP | 错误 | 处理 |
| --- | --- | --- |
| 400 | MESSAGE_CONTENT_INVALID、READ_POSITION_INVALID | 空白/超长正文、越界阅读位置 |
| 400 | CONVERSATION_SCOPE_INVALID | 命名空间或通用字符串键格式错误 |
| 401 | UNAUTHORIZED | 现有登录恢复 |
| 404 | CONVERSATION_NOT_FOUND | 组织不匹配、非参与人、资格失效等不泄露资源 |
| 409 | CONVERSATION_KEY_CONFLICT | 同租户、同 namespace、同 key 对应不同参与集合、授权类型或 context_key |
| 409 | MESSAGE_IDEMPOTENCY_CONFLICT | 同一 UUID 对应不同正文 |
| 409 | CONVERSATION_CLOSED | 可读历史，禁止发送 |
| 409 | CONVERSATION_PEER_UNAVAILABLE | 对方账号或参与资格失效 |

业务异常集中于 exceptions.py，继承 AppException 体系。静态 schema 错误沿用项目的 400 响应，不另建信封。

## 7. 消息写入、顺序与幂等

### 7.1 为什么需要会话内 seq

数据库全局自增 ID 的分配顺序不等于提交顺序。若两条消息并发分配了 ID，但较大的先提交，客户端直接按全局 ID 推进位置可能漏掉后提交的小 ID。

因此，每个会话在数据库行锁内分配 seq，同一会话的新增消息按锁顺序提交。不同会话互不串行。

### 7.2 发送事务

~~~text
1. 根据明确组织与请求模式定位当前有效参与人。
2. 开启 transaction.atomic()。
3. 按 organization + conversation_id 取得 Conversation 并 select_for_update()。
4. 在锁内重新校验当前用户、参与人和组织资格。
5. 查找 conversation + sender_member + client_message_id。
   - 已存在且正文相同：直接返回旧消息，不更新会话，不再生成提醒。
   - 已存在且正文不同：返回幂等冲突。
6. 对首次发送校验 status=active，对方仍启用且具备相应参与资格。
7. seq = conversation.last_message_seq + 1。
8. 插入 Message。
9. 同一事务更新 last_message_seq、last_message、last_message_at。
10. 注册事务提交后的补充通知回调。
11. 提交，返回消息。
~~~

规则：

- 已授权的原消息重放可在会话关闭或对方失效后返回原结果，不产生新写入。
- 事务回滚时，消息、最后消息位置和通知回调全部回滚。
- 数据库唯一约束作为并发的最终保障。
- 不使用进程内锁或 Redis 锁代替数据库行锁。
- 对同一会话的写入统一先锁 Conversation，再处理参与人，不引入反向锁顺序。

### 7.3 重试契约

- 客户端第一次点击发送生成 UUID，将 UUID 与正文共同保存在本次待发送项。
- 超时、断网、登录恢复、用户点击重试都复用该 UUID 和正文。
- 内容修改后视为新的消息，必须生成新的 UUID。
- 页面重载后的恢复以服务端消息为准；首期不把聊天正文持久化到本地离线草稿箱。
- 手写请求适配器仅对已具备上述幂等保障的发送请求设置安全重放，不放开所有 POST 的自动重试。

## 8. 已读和未读

### 8.1 已读更新

客户端只在页面处于前台且对应位置确实进入可见阅读范围后提交 last_read_seq；不能收到列表或增量响应就把尚未展示的新消息全部标记已读。

该字段采用“已读至此处”的语义，不记录每条消息是否单独曝光：用户看到 seq=N 的位置后，将 N 及之前的消息视作已读，包括初次进入时没有全部加载的更早历史。用户停留在历史区域时，不能推进到尚未看到的最新位置。这是位置模型的明确行为，不宣称提供逐条阅读证明。

服务端执行：

~~~text
验证参与人及组织
验证 0 <= 请求位置 <= 当前 last_message_seq
在会话锁内更新：
last_read_seq = max(原 last_read_seq, 请求位置)
~~~

相同或更小位置重复提交不会使已读倒退；多个设备的延迟请求同样适用。

发送自己的消息不自动推进已读位置，避免误把之前尚未阅读的对方消息标记已读。

### 8.2 未读公式

~~~text
Message.conversation == 当前会话
AND Message.seq > 本人 last_read_seq
AND Message.sender_member_id != 本人 member_id
~~~

不能直接使用 last_message_seq - last_read_seq，因为其中可能包含自己发送的消息。

首期直接用数据库聚合查询，不持久化 unread_count。列表读取用受控聚合及 select_related/prefetch_related，不能逐会话额外执行 count 查询。

会话未读、分组织未读和未读会话数使用同一资格过滤，并与可选 namespace 筛选保持一致；成员被移除或撤销后立即从后续统计中排除。

## 9. 可选通知集成

### 9.1 通用聊天不依赖通知完成收发

双方未读、会话列表和消息读取都来自 messaging。现有站内通知仅是补充提醒；关闭该集成或通知失败时，会话功能仍完整。

集成函数放 apps/messaging/notifications.py，使用通用 Conversation、Message、ConversationMember 生成提示，不检查房源、车辆或交易角色。

- 事务提交后，只对具备当前组织成员资格的 organization_member 接收人调用现有 notify()。
- business_party 从通用聊天入口取得未读提示，不伪装为组织成员，也不改用 organization=None。
- 两名 business_party 的会话不生成现有组织通知，但双方收发和聊天未读完整可用。
- 不放宽现有 notify() 的组织成员校验。

### 9.2 提醒契约

- 类别：messaging.message，默认启用 in_app，允许关闭。
- target：Conversation；data 保存 conversation_id、message_seq、organization_slug，不复制业务状态。
- 标题与正文使用通用提示，不复制完整聊天内容。
- 深链指向通用聊天页并携带正确租户。
- 只有成功新增消息才注册事务提交后的提醒，幂等重放不重复投递。
- 提醒生成失败记录结构化错误，不能让已提交消息返回发送失败。
- 首期为尽力提醒，不增加 outbox 或承诺必达。
- 通知已读、删除、清理不修改会话阅读位置；聊天已读也不反向表示所有通知都已读。
- 两类未读分别展示；消息入口使用红点表示任一来源未读，不把两个数字相加。

services.py 可以调用这个平台集成函数；notifications.py 不反向导入 services.py，也不导入具体业务，避免循环依赖。

## 10. 业务接入契约和房源适配示例

### 10.1 任意业务接入的固定步骤

业务模块完成以下工作后调用核心：

1. 根据自己的接口与当前用户，校验业务资源是否可访问、是否允许发起沟通。
2. 从业务事实确定组织，不信任客户端自报的组织归属。
3. 选择两个真实、启用且经业务授权的参与账号，确定各自通用 access_kind。
4. 在自己的命名空间中生成稳定会话复用键，并提供字符串 context_key。
5. 调用 get_or_create_conversation()，返回通用 ConversationOut。
6. 前端拿 organization、conversation_id 和本人参与方式打开通用聊天页。
7. 资源失效或权限变化时，按业务决定调用关闭或撤权服务。

业务服务对资源授权负责；核心再次检查组织启用、账号启用、两个账号不同、actor 在参与集合中及各 organization_member 的真实成员资格。

不能以“已经创建聊天会话”为由扩大业务资源访问权，资源详情仍由原业务接口鉴权。

### 10.2 房源是第一个业务适配，不进入核心

沿用现有 POST /api/house/tenant/contact/ 和房源详情“预约联系”弹层。API 校验公开房源，组织从 house.organization 推导；contacts.py 继续记录 HouseInquiry 和联系方式偏好，并在同一事务委托 apps/house/services/messaging.py 发送真实文字消息。

- 优先复用该客户、该房源尚未关闭咨询的有效 assigned_to；原接待人失效或未分派时，才按 resolve_contact_recipient() 选择当前有效责任人或 owner。
- 拒绝自聊并回滚咨询、设置及聊天写入。没有接待人时沿用咨询落库行为，返回空聊天结果，前端明确提示暂时无法开始聊天。
- 使用 real_estate.inquiry 命名空间，关联键为 listing:<house_id>，会话键为 inquiry:<inquiry_id>:agent:<agent_id>。接待人或咨询归属改变时不把新的参与人追加进旧单聊。
- 客户使用 business_party，接待人使用 organization_member；外部客户不会因此成为组织成员。
- 正文包含房源编号和本次选中的规范化手机号、微信号，不复制未选择的联系方式或动态房源名称。
- 新发送只生成 messaging.message 提醒；历史 house.contact 通知及其客户转换入口保持兼容。

业务适配调用形态为：

~~~python
get_or_create_conversation(
    actor=customer,
    organization=house.organization,
    namespace="real_estate.inquiry",
    conversation_key=f"inquiry:{inquiry.pk}:agent:{agent.pk}",
    context_key=f"listing:{house.pk}",
    participants=[
        ParticipantSpec(
            user_id=customer.pk, access_kind="business_party"
        ),
        ParticipantSpec(
            user_id=agent.pk, access_kind="organization_member"
        ),
    ],
)
~~~

这是房产业务适配中的调用示例，不写入 messaging/models.py、api.py 或核心 schema。

实际业务 HTTP 契约为：

~~~text
POST /api/house/tenant/contact/
{
  "house_id": 123,
  "channels": ["phone"],
  "phone": "+8613800138000",
  "client_message_id": "客户端生成的 UUID"
}

201 {
  "notification_id": null,
  "inquiry_id": 12,
  "conversation": 通用会话或 null,
  "message": 已保存消息或 null
}
~~~

该入口不接受组织、接待人、namespace 或参与类型。UUID 对旧客户端可省略，新客户端必须生成并在同一逻辑发送重试时复用。已保存消息通过 find_sent_message() 恢复原会话及咨询，避免接待变化或原咨询关闭后把同次发送写入新会话；相同 UUID 改正文返回 409。无接待时未生成 Message，保留原咨询保存行为，不建立额外发送回执表。

前端收到真实会话和消息后关闭联系弹层，直接打开 business_party 聊天路由；导航失败保留成功回执，重试仅重新打开聊天。账号、房源或输入变化后作废旧尝试；同账号认证恢复可以安全重放。

### 10.3 车辆与其他业务如何接入

将来车辆业务在自己的服务中完成车辆权限和参与人选择，然后传入：

~~~text
namespace = vehicles.inquiry
context_key = vehicle:<UUID 或业务字符串>
conversation_key = 由车辆业务决定的稳定沟通键
participants = 由车辆业务授权的两个 ParticipantSpec
~~~

使用相同的三张聊天表、发送/已读接口及聊天页面。无需在核心新增车辆枚举、car_id 字段、if namespace 分支或车辆模型导入。

本次不创建车辆文件；通过通用契约测试使用不同命名空间和字符串键证明接入能力。

## 11. 通用客户端与业务入口

### 11.1 通用客户端职责

小程序/H5 与管理端的聊天逻辑只处理租户、参与方式、会话、消息、阅读位置和轮询，不导入具体业务接口。

- 列表可显示当前租户下本人所有业务会话，也可由上层传入 namespace 筛选。
- 会话标题使用对方名称，消息采用纯文字，业务命名空间不直接作为产品文案。
- 首次加载最近消息，上拉历史，保留滚动位置。
- 发送中和失败项绑定原租户、会话及 UUID；重试保持正文和 UUID。
- 停留历史区域时，不强制滚动或推进到尚未看到的消息位置。
- can_send=false 时展示通用阻断原因，保留可访问历史。
- 不根据 house、vehicle、order 等 namespace 在聊天页内切换接口。
- 业务资源摘要、房源详情、车辆信息等展示留在对应业务页面；首期通用页不增加业务卡片或动态业务渲染注册表。

### 11.2 小程序/H5

消息页提供“聊天”“通知”分栏。组织成员列表只显示当前组织及本人对应参与模式；个人业务会话先明确组织再读取，组织发现只列出本人有效参与的组织。

通用路由区分组织成员上下文与外部业务会话资源定位：

~~~text
组织成员：
/pages/messages/conversation?id=21&organization_slug=tenant-a

外部业务参与人：
/pages/messages/conversation?id=21&chat_tenant_slug=tenant-a
~~~

chat_tenant_slug 不触发“切换成组织成员”；组织模式继续复用 organization_slug。请求模式以明确路由和后端返回的本人参与方式组织，不能只根据账号是否属于某个组织推断。

任何业务前端仅需要：

~~~text
业务创建会话接口
  -> 得到通用会话及本人参与方式
  -> 使用统一路由帮助函数打开聊天
  -> 后续收发、历史和未读交给通用聊天功能
~~~

房源按钮在房源页面，未来车辆按钮在车辆页面；通用 useConversation 和页面不因此修改。

### 11.3 管理端

当前组织工作区提供“我的聊天”，使用通用后端能力和 30 秒后台轮询。导航入口不增加管理员读取其他人内容的权限。

页面中 Ant Design X 已覆盖的聊天交互直接复用官方组件：Conversations 提供会话列表与发起聊天入口，Bubble.List 提供消息列表，Sender 提供内置输入框与发送按钮，Welcome 提供聊天空状态；通用封装为 ChatMessageList、ChatComposer。页面采用统一的左右布局，历史加载通过 Bubble.List 的滚动容器 ref 保持阅读位置。此次只实现文字消息，不提供附件上传、图片发送或 AI 请求。普通 Enter 换行，Ctrl / Command + Enter 发送，最多 2000 字；正文按纯文字展示。

手写适配放 services/manual，生成客户端不手改。组织内单聊的候选人来自通用 peers 接口，不依赖房产业务中的接待人目录。

管理端右上角头像菜单提供“我的聊天”和“个人通知”入口，头像和两个菜单项分别显示未读红点。聊天未读独立查询，不依赖聊天通知偏好；阅读聊天后立即更新对应红点。移除独立铃铛与侧栏重复聊天入口，保留原聊天路由和 30 秒后台刷新。个人通知页面提供“开启桌面通知”按钮，点击后才申请浏览器权限；后台收到新通知时显示桌面提醒，首次加载不批量弹出历史通知。点击提醒可进入对应任务、会话或通知详情；切换账号/租户时取消旧请求并关闭旧提醒。该能力要求管理端页面仍然打开，不提供关闭页面后的推送。

### 11.4 轮询与状态隔离

| 场景 | 策略 |
| --- | --- |
| 管理端聊天详情/列表/通知中心 | 前后台均约 30 秒刷新；详情查询 after_seq |
| 管理端隐藏 | 继续补取，隐藏期间不推进聊天阅读位置；返回前台立即刷新 |
| 小程序/H5 前台 | 详情约 3 秒、列表约 10 秒刷新 |
| 小程序/H5 隐藏、各端退出登录 | 停止调度 |
| 请求失败 | 管理端下一轮 30 秒重试；小程序/H5 保持 3、6、12、24、30 秒退避 |
| 增量超过一页 | 串行补取，避免重叠 |
| 进入或切换组织 | 立即刷新 |

使用请求完成后的 setTimeout，不用 setInterval 堆叠慢请求。默认时钟通过箭头函数包装原生 setTimeout/clearTimeout，避免浏览器将原生 Window 方法绑定到普通时钟对象。

状态与缓存键包括：

~~~text
user_id + access_kind + organization_slug
+ namespace_filter（列表和统计）
+ conversation_id（详情）
~~~

切换账号、参与模式、组织或列表 namespace 筛选时递增请求代次；旧响应不得回填新状态。未读请求、发送中项、重试 UUID 同样遵循此规则。

context.ts 仅保存通用租户选择、筛选和请求代次，不保存 buyer、house_id、car_id 或聊天正文。

## 12. 数据一致性与平台生命周期

### 12.1 创建和复用会话

组织、namespace、conversation_key 的唯一性和两个参与人处于同一事务。并发冲突后只恢复完整既有会话，不能留下空缺参与人。

相同复用键再次调用时，必须比对原 context_key、参与账号集合和各 access_kind：

- 完全一致时返回既有会话，不生成新记录。
- 不一致时返回 CONVERSATION_KEY_CONFLICT，不能静默替换或扩展参与人。
- 不因再次创建请求自动清除 revoked_at 或重开 closed 状态。
- 业务希望更换沟通双方时，应自行决定新的会话键和旧会话生命周期。

### 12.2 账号合并

现有轻量账号合并会停用源账号，因此平台集成必须把聊天参与记录纳入 _ensure_lightweight_merge_source() 的业务身份检查。

源账号已有聊天时复用现有 AccountMergeReviewRequired 分支，不在首期自动迁移参与人、历史或复用键。无聊天账号保持原流程。

这项集成只依赖 user_has_messaging_history()，不检查聊天来自房产还是车辆。

### 12.3 状态与加锁

- 发送、已读、参与资格撤销和关闭都先锁 Conversation。
- 锁内重新检查资格与状态。
- 按关联对象批量关闭时，查询条件必须包含 organization、namespace、非空 context_key，按会话 ID 固定顺序处理。
- 组织成员失效通过每次请求的真实成员检查生效，不依赖具体业务信号。
- 业务资源状态变化通过显式公共服务改变会话，核心不订阅所有业务模型信号，不查询动态 ContentType。

## 13. 调整后的文件落点

### 13.1 通用后端核心

~~~text
apps/messaging/
  __init__.py
  apps.py
  contracts.py                 # ParticipantSpec 等简单内部输入契约
  constants.py                 # 通用状态与授权方式，无业务类型枚举
  exceptions.py
  models.py                    # 三张通用表
  schemas.py                   # 通用 HTTP 结构，无业务资源字段
  services.py                  # 权限、收发、幂等、顺序、已读、未读
  notifications.py             # 可选平台通知集成，无具体业务依赖
  api.py
  migrations/
    __init__.py
    0001_initial.py

tests/messaging/
  __init__.py
  test_models.py
  test_services.py
  test_api.py
  test_concurrency.py
  # 多 namespace、字符串关联键与外部参与契约由 test_services.py 覆盖
~~~

核心不预建 repository、业务 provider、业务插件目录、事件总线或未来业务 app。contracts.py 只定义真实调用所需的数据结构，不建立多层工厂。

### 13.2 平台接入

| 文件 | 修改 |
| --- | --- |
| config/settings/_base.py | 注册 app、通用通知类别和 Conversation 目标清理 |
| config/api.py | 挂载通用 messaging router |
| apps/accounts/services.py | 通过公共服务补充轻量合并检查 |
| tests/accounts/test_wechat_phone.py | 验证有聊天与无聊天的账号合并行为 |

这些是平台集成，不属于房产业务接入。

### 13.3 通用小程序/H5

~~~text
frontend_miniprogram/src/services/manual/messaging.ts
frontend_miniprogram/src/features/messaging/types.ts
frontend_miniprogram/src/features/messaging/polling.ts
frontend_miniprogram/src/features/messaging/conversation-controller.ts
frontend_miniprogram/src/features/messaging/unread-badge.ts
frontend_miniprogram/src/features/messaging/ConversationList.vue
frontend_miniprogram/src/features/messaging/context.ts
frontend_miniprogram/src/features/messaging/useConversation.ts
frontend_miniprogram/src/features/messaging/useConversationList.ts
frontend_miniprogram/src/features/notifications/tabbar-badge.ts
frontend_miniprogram/src/pages/messages/index.vue
frontend_miniprogram/src/pages/messages/conversation.vue
frontend_miniprogram/src/pages/messages/peers.vue
frontend_miniprogram/src/modules/routes.ts
frontend_miniprogram/src/domain/route-access.ts
frontend_miniprogram/src/App.vue
frontend_miniprogram/tests/messaging.test.ts
~~~

通用 messaging.ts 只请求 /api/messaging/，不调用 /api/house/ 或未来车辆接口。

统一处理消息入口红点，原通知计数更新只能更新通知来源，不能覆盖聊天来源；App.vue 在前台同步当前租户来源，后台停止调度。

routes.ts 把会话页加入受保护消息路由；route-access.ts 区分组织身份上下文与外部会话租户定位，保持与业务类型无关。

### 13.4 通用管理端

~~~text
frontend_admin/src/services/manual/messaging.ts
frontend_admin/src/services/manual/notifications.ts
frontend_admin/src/hooks/useBackgroundPolling.ts
frontend_admin/src/components/NotificationBell/index.tsx
frontend_admin/src/components/RightContent/AvatarDropdown.tsx
frontend_admin/src/components/Chat/index.ts
frontend_admin/src/components/Chat/Composer.tsx
frontend_admin/src/components/Chat/MessageList.tsx
frontend_admin/src/pages/messaging/index.tsx
frontend_admin/src/pages/messaging/hooks.ts
frontend_admin/src/pages/messaging/index.test.tsx
frontend_admin/src/services/manual/authenticatedState.ts
frontend_admin/src/services/manual/navigationAccess.ts
frontend_admin/src/services/manual/teamOperations.ts
frontend_admin/src/utils/notificationRouting.ts
frontend_admin/src/utils/orgSelection.ts
frontend_admin/config/routes.ts
frontend_admin/src/utils/adminRouting.ts
~~~

两端 OpenAPI 产物由各自命令生成，不手改。实施时编写 wot-ui、Ant Design 代码前按 AGENTS.md 查询组件 API。

聊天通知的管理端深链包含 organization_slug 和 conversation_id。目标组织与当前组织不同时，先用显式请求头只读验证真实成员资格及权限快照；快照成功且账号、组织选择版本均未变化后，才同步全局请求组织与界面。失败、离页、交错响应或 A→C→A 的手动切换均不能提交过期快照，不调用可能迟到改写 session 的 select 接口。

### 13.5 第一业务适配：房源

~~~text
apps/house/services/messaging.py
apps/house/services/contacts.py
apps/house/api/tenant.py
apps/house/schemas/tenant.py
tests/house/test_tenant_portal.py
tests/house/test_rental_closure.py
tests/house/test_contact_messaging.py

frontend_miniprogram/src/services/manual/tenant-rental.ts
frontend_miniprogram/src/features/tenant-rental/service.ts
frontend_miniprogram/src/features/tenant-rental/contact-submission.ts
frontend_miniprogram/src/pages-housing/detail/index.vue
frontend_miniprogram/tests/tenant-contact-submission.test.ts
frontend_miniprogram/tests/tenant-rental.test.ts

frontend_admin/src/utils/notificationRouting.ts
frontend_admin/src/pages/platform-management/notifications/index.tsx
frontend_admin/src/pages/messaging/index.tsx
~~~

现有联系入口在业务适配中发送消息；两端通知入口识别通用 messaging.message 数据，聊天页继续只调用通用接口。通用聊天模块无需导入房源文件。

未来其他业务在自己的目录增加相同职责的适配与入口，不向 apps.messaging 或 features/messaging 中增加业务专用文件。本次不创建车辆目录。

## 14. 分阶段实施计划

阶段一至六交付通用 IM；阶段七是独立的首个业务接入。房源适配未接入时，通用核心必须已经能独立测试、运行及验收。

### 阶段一：通用契约、模型与会话复用

- [x] 新建 app、三张表、ParticipantSpec、通用枚举和业务异常。
- [x] 实现组织 + namespace + conversation_key 唯一性、字符串 context_key。
- [x] 实现通用会话创建、既有参与集合一致性校验及冲突处理。
- [x] 实现 im.direct 包装与当前组织候选成员查询。
- [x] 使用仅有 User、Organization 的数据验证核心，不创建房源或其他业务模型。
- [x] 验证两个命名空间、UUID/字符串键、两个外部参与人的会话。

交付：新业务可通过统一输入创建授权会话，核心没有业务字段或业务模型依赖。

### 阶段二：权限、消息与 HTTP

- [x] 实现组织/外部模式、租户与参与人统一鉴权及个人可选组织发现。
- [x] 实现会话行锁、seq、发送幂等与同键不同内容冲突。
- [x] 实现历史/增量分页、单调已读与未读聚合。
- [x] 实现通用 can_send 和参与资格失效处理，不查询业务资源。
- [x] 接入全部通用接口，支持 namespace 缩小列表及统计。
- [x] 验证跨租户访问、并发发送、超过一页增量和多设备已读。

交付：无房产业务参与也能完成创建、双向收发、已读和刷新回读闭环。

### 阶段三：平台集成与生命周期

- [x] 在 notifications.py 完成可选通用提醒，验证失败不影响已保存消息。
- [x] 接入账号合并的聊天身份检查，保留现有无聊天账号行为。
- [x] 实现撤权和按组织 + namespace + context_key 关闭会话。
- [x] 验证账号停用、成员移除、外部授权撤销与关闭后的访问行为。
- [x] 验证同名业务对象不会跨命名空间或跨租户批量关闭。

交付：核心与平台基础能力衔接，业务通过显式公共服务管理会话生命周期。

### 阶段四：通用小程序/H5

- [x] 生成 OpenAPI，只在 messaging.ts 中适配通用接口。
- [x] 完成租户选择、会话列表和通用文字聊天页。
- [x] 完成轮询、分页、失败重试、已读与两来源红点。
- [x] 完成受保护路由、外部参与方式深链与旧请求代次隔离。
- [x] 验证切换 namespace 列表筛选不会回填旧列表和未读。
- [ ] 用无具体业务资源的授权测试会话完成 H5 双账号及微信设备验收。（H5 已验证，微信设备待验。）

交付：任何业务返回会话后都能打开同一聊天页面。

### 阶段五：通用管理端

- [x] 生成管理端 OpenAPI，完成通用请求适配。
- [x] 实现当前组织的“我的聊天”、同组织成员单聊、历史与回复。
- [x] 验证小程序与管理端读位置一致、组织切换隔离及停止后台轮询。
- [x] 验证 owner 不能读取其他人的会话，页面不调用具体业务接口。

交付：组织成员可以跨客户端继续同一会话，不依赖房产页面。

### 阶段六：通用能力独立验收

- [x] 执行核心测试、账号/通知回归、前端针对性测试、类型检查及构建。
- [x] 用两个虚构命名空间执行相同核心流程，不创建对应业务 app 或资源。
- [x] 验证整数外观字符串、UUID、订单号和相同关联键均可使用且不会串业务。
- [x] 验证组织 A/B、内部/外部参与方式、两名外部参与人的隔离矩阵。
- [x] 检查核心、通用手写适配和页面不存在具体业务导入或 namespace 特判。
- [x] 记录数据库查询、轮询行为、真实回读和设备验收结果。

交付：通用 IM 底座完成，不以首个业务页面上线作为完成前提。

### 阶段七：首个业务接入——房源适配

- [x] 在 house 服务完成公开房源校验、组织推导、接待人选择及通用会话调用。
- [x] 沿用联系方式 API，原子记录咨询、联系方式偏好及真实消息，保持历史通知兼容。
- [x] 详情页发送后直接打开通用聊天，处理 UUID 重试、导航失败和无接待结果。
- [x] 统一使用聊天通知，管理端深链明确目标组织并校验成员及参与资格。
- [x] 验证接入未增加 messaging 业务模型依赖、业务字段或业务分支；通用服务只补充范围受限的消息恢复能力。
- [x] 回归原房源联系功能，完成 H5 客户与管理端接待人真实业务沟通、通知深链及刷新回读验收；微信真机仍待验。

交付：首个业务证明公共接口可用；未来接入其他业务遵循同样步骤，不先创建未来业务代码。

## 15. 验证矩阵与实施后命令

下列命令作为后续维护的验证方式。本轮实际执行结果记录在第 16.4 节，测试范围与运行边界分别说明。

### 15.1 核心必须覆盖

| 类别 | 用例 |
| --- | --- |
| 业务无关 | 只创建用户、组织和聊天对象，不使用 House 等业务模型即可完成收发 |
| 命名空间 | 同租户下两个 namespace 使用相同会话键不合并；筛选及未读口径一致 |
| 关联键 | 整数外观字符串、UUID、订单号均不需要修改核心 schema 或模型 |
| 两层隔离 | 相同 namespace/key 在 A/B 组织分别独立；同组织不同 namespace 的 context_key 不互相关闭 |
| 参与人通用性 | 两内部、内外、两外部三种组合；actor 必须是参与人且业务外部授权不能由客户端自报 |
| 参与集合冲突 | 相同唯一键对应不同参与人、access_kind 或 context_key 时返回 409，不能修改原授权 |
| 租户权限 | URL/header 不同、跨租户 ID、非参与人、owner 和超级管理员无参与记录均拒绝 |
| 生命周期 | 停用、移除、撤权、关闭后的行为符合通用规则；没有隐式业务状态查询 |
| 创建并发 | 相同唯一键只得到一个完整会话和两个参与人 |
| 幂等 | 相同 UUID/正文返回同记录；不同正文 409；不重复提醒 |
| 顺序与事务 | PostgreSQL 独立连接并发，seq 唯一且提交顺序可靠；回滚不更新最后消息或通知 |
| 分页 | 最近、before_seq、after_seq、多批补取完整 |
| 已读 | 不倒退、不越界、自己的消息不计未读，读位置语义明确 |
| 通知 | 关闭偏好、清理、删除或生成失败不改变聊天事实；两外部会话无通知仍能收发 |
| 账号合并 | 有聊天走现有业务身份分支，无聊天账号行为保持 |
| 客户端 | 核心聊天请求不调用业务 API；租户、账号、参与方式及 namespace 切换拒绝旧响应 |

test_services.py 与 test_api.py 使用互不相同的虚构命名空间、UUID 和订单号等字符串键；不创建对应业务 app 或资源。两组数据调用相同公共服务和 HTTP 接口，验证不需要新增业务分支。

并发测试使用 pytest-django 事务模式和 PostgreSQL 独立连接，不能用 SQLite 或单连接回滚事务替代。

### 15.2 通用后端

~~~bash
docker compose exec web python manage.py check
docker compose exec web python manage.py makemigrations --check --dry-run
docker compose exec web python manage.py migrate --plan
docker compose exec web pytest tests/messaging tests/notifications tests/accounts/test_wechat_phone.py --ds=config.settings.test_runner
~~~

新增迁移由 Django 命令生成；先核对迁移计划，不清空数据库或重建容器来绕过问题。

第一业务接入完成后单独回归：

~~~bash
docker compose exec web pytest tests/house/test_tenant_portal.py tests/house/test_business_services.py tests/messaging --ds=config.settings.test_runner
~~~

### 15.3 小程序/H5

在 frontend_miniprogram 目录执行，先切 Node 22：

~~~bash
source ~/.nvm/nvm.sh
nvm use 22
pnpm openapi
node --experimental-strip-types --test tests/messaging.test.ts tests/notifications.test.ts
pnpm type-check
pnpm exec eslint src/services/manual/messaging.ts src/features/messaging src/features/notifications/tabbar-badge.ts src/App.vue src/pages/messages src/modules/routes.ts src/domain/route-access.ts
pnpm build:h5:prod
pnpm build:mp:prod
~~~

通用能力验证不要求修改房源详情页。房源接入后再追加：

~~~bash
node --experimental-strip-types --test tests/tenant-contact-submission.test.ts tests/tenant-rental.test.ts
pnpm exec eslint src/services/manual/tenant-rental.ts src/features/tenant-rental src/pages-housing/detail/index.vue
~~~

原通知测试保留功能行为断言，不通过移除测试掩盖分栏回归。

### 15.4 管理端

在 frontend_admin 目录执行，保持 npm：

~~~bash
source ~/.nvm/nvm.sh
nvm use 22
npm run openapi
npm exec -- vitest run src/pages/messaging/index.test.tsx
npm run lint
npm run build
~~~

Schema 来源核对 http://localhost:18000/api/openapi.json，交互文档为 http://localhost:18000/api/docs。生成服务不手改。

### 15.5 运行和视觉验收

1. 两个无业务模型的测试会话可完成双向发送、刷新回读和已读推进。
2. 相同用户在 A/B 组织、不同 namespace 中的会话、未读和生命周期互不影响。
3. A 的慢响应在切到 B 后不能回填；namespace 筛选变化也保持一致。
4. 消息已保存但响应丢失后重试，只存在一条消息。
5. 关闭通知集成或双方均为外部参与人时，聊天仍完整可用。
6. 个人业务会话深链不错误切换为组织成员模式。
7. 管理端隐藏时继续每 30 秒刷新且不自动已读；小程序/H5 隐藏停止轮询，重新进入补取；H5/微信设备的键盘、滚动和历史加载正常。
8. 单独接入房源后，在没有修改通用聊天逻辑的前提下完成业务沟通。

临时截图写入 .codex/audits/tenant-isolated-messaging/，不写项目根目录，不默认提交。

## 16. 通用性验收、性能边界与交付条件

### 16.1 通用性是交付条件

新增房产、车辆或其他业务接入时，在文字单聊能力范围内应满足：

- 不修改 messaging 的三张表，不增加业务外键或业务角色枚举。
- 不在核心 services.py、api.py、schemas.py 中增加业务导入或 namespace 分支。
- 不修改通用消息、阅读位置或轮询接口。
- 不修改通用 useConversation、会话列表和聊天页来调用业务 API。
- 只在业务自身新增资源鉴权、参与人决策、稳定复用键、生命周期适配及入口。
- 同一份公共契约通过至少两个不同虚构业务命名空间的集成测试。
- 首个真实业务的接入与核心独立验收可以分别交付。

### 16.2 性能与日志

首期针对低频业务沟通，每个详情页只保留一个串行增量请求，列表与详情不重复轮询同一数据。

请求耗时较小时，100 个前台详情按 3 秒间隔约产生 33 次增量查询/秒。这是频率估算，不是实测容量。先核对 SQL、索引、数据库负载，再决定实时传输扩展。

日志记录组织、namespace、会话、消息、请求标识和错误码，不记录完整正文、Token 或联系方式。

### 16.3 基础可靠性交付条件

- 会话组织必填且不可迁移；读写与统计统一执行租户和参与资格校验。
- namespace 与不透明关联键不扩大权限，不产生跨业务错误复用或批量关闭。
- 重试与并发不重复消息、不漏增量，刷新回读能验证保存结果。
- 读位置单调，未读不包含自己的消息。
- 外部参与人不会因此获得组织成员权限。
- 通知与聊天生命周期独立，通知故障不阻断会话。
- 两端切租户、参与方式、账号或 namespace 筛选不会混入旧数据；管理端后台继续刷新，小程序/H5 隐藏时停止轮询。
- 平台通知、账号合并及首次业务接入各自完成针对性回归。
- 实际测试、构建和设备验收分别记录，未验证的项目不能标记完成。

### 16.4 本轮实现与验证记录

- 通用核心、平台通知/账号兼容、小程序/H5 与管理端入口已实现，具体业务适配没有加入核心。
- 本地 messaging.0001_initial 已成功应用；Django check、无缺失迁移检查、后端 Ruff 与 scoped Ty 检查通过。
- 后端针对性回归 165 项通过：聊天、通知和微信手机号/账号合并。使用独立测试库，包含真实 PostgreSQL 多连接并发、规范化正文边界、整体删除级联及列表查询数量验证。
- 管理端针对性测试 33 项通过；lint、TypeScript 与生产构建通过。
- 小程序联合回归 44 项通过：聊天、HTTP 重放保护、通知、路由及认证恢复；类型、定向 ESLint、H5 与微信生产构建通过。
- 真实浏览器已验证管理端与 H5 发送返回 201、刷新后回读；H5 生产产物可自动补取外部参与人回复，并隔离两个租户的消息。
- 登录恢复、跨账号旧正文隔离、入口未读红点和浏览器原生定时器 receiver 均有针对性回归。
- 验收截图在 .codex/audits/tenant-isolated-messaging/，不作为待提交业务资源。独立验收账号已停用、组织已归档。
- 浏览器夹具兼容了本地组织表保留的旧 created_by 列；没有修改这一历史迁移或组织业务代码。

### 16.5 房源联系方式接入聊天的实现与验证记录

- 现有联系 API 已原子记录 HouseInquiry、偏好与真实聊天消息，返回 inquiry_id、conversation、message；兼容 notification_id 字段固定为空。新发送只生成 messaging.message，历史 house.contact 的展示与转客户保持兼容。
- 原有效咨询接待人优先，真实转派后同 UUID 仍恢复原消息；重复发送不重复记录或提醒。无接待人仅保存咨询并明确提示，自聊返回 409，消息写入失败回滚业务写入。
- 前端使用生成的客户端和个人请求作用域；同账号认证恢复安全重放，换账号/房源/输入作废旧尝试。导航前关闭缓存页弹层，失败保留成功回执且仅当前有效页面恢复弹层，重新打开不重发消息。
- 管理端通知显示“聊天消息”并生成目标组织深链；显式组织快照与选择版本防止失败、卸载、交错请求或往返切换留下错误组织状态。规格复审及两轮质量复审发现的问题均已修复。
- 最终后端回归为 323 项及 23 项子测试通过，显式使用 config.settings.test_runner 和独立测试库；范围包括联系入口、聊天、通知、客户咨询、责任人、房源与房东兼容接口。Django check、缺失迁移检查、9 个相关 Python 文件 Ruff/格式及 6 个生产文件 Ty 均通过。
- 小程序/H5 定向测试 43 项通过，类型检查、全量 ESLint、H5 与微信生产构建通过；管理端定向测试 11 个文件 102 项通过，TypeScript、Biome、Ant Design lint 和生产构建通过。两端 OpenAPI 均通过项目生成器更新，未手改生成文件，未改依赖或多语言。
- 额外小程序全量测试为 369/380，11 项未通过，集中于既有首页、导航、筛选和平台存储结构断言；未扩展本次业务接入范围去修改这些测试或结构。日志位于 frontend_miniprogram/.codex/audits/house-contact-im/frontend-tests.log。
- 最新生产构建的真实浏览器验收已完成：详情点击发送返回 201并进入 business_party 会话；原联系弹层关闭；通知正确分类并能打开管理端会话；从 B 组织进入 A 组织会话不会向 B 请求该会话；接待人回复后 H5 自动补取，双方刷新可回读。最终两端验收页面控制台无错误。
- 实际接口回读验证同 UUID 返回原消息、没有重复提醒，客户和接待人使用另一租户访问原会话均返回 404。验收共进行两次独立联系发送与一次接待人回复，生成 1 条咨询、3 条消息、2 条聊天通知、0 条旧联系通知。
- 截图与接口核对记录在 .codex/audits/house-contact-im/。独立验收账号已停用、组织已归档、临时会话已设置过期，临时本地预览服务已停止。未操作 Git；未执行部署、微信真机或原生键盘验收。
- 微信真机、原生键盘及设备上的历史滚动位置仍待人工验收；未执行仓库全部测试或生产发布。
- 管理端已接入 Ant Design X 会话列表、原生消息列表、输入框与空状态，未接附件/图片上传。此次前端页面与传输适配 14 项回归通过，包括原生组件、会话键盘选择、历史滚动及已读同步；TypeScript、定向 Biome 与管理端生产构建通过。后端 messaging 上轮 50 项回归通过，本轮未修改后端；浏览器确认现有文字历史可正常显示，本轮未向真实参与人发送验收消息。
- 2026-10-25：管理端接入全局通知铃铛和浏览器桌面通知入口，复用任务、聊天等已有通知；通知中心、聊天列表及当前聊天记录采用 30 秒后台刷新。同页通知跳转会更新任务/通知详情；后台聊天补取不推进阅读位置。10 个文件的 64 项定向测试、TypeScript、定向 Biome 与生产构建通过；真实浏览器记录了通知和当前会话约 30 秒的请求间隔。桌面通知的授权、增量去重及点击逻辑通过模拟测试，未主动申请系统权限或生成真实桌面弹窗；验收记录位于 .codex/audits/messaging-browser-notifications/。
- 管理端聊天与个人通知入口已集中到头像菜单；聊天与通知独立统计红点，聊天阅读完成后即时刷新聊天未读。移除顶栏独立铃铛和侧栏聊天入口，桌面授权入口迁至个人通知页面。11 个文件的 68 项定向测试、TypeScript、定向 Biome 与生产构建通过；真实浏览器已验证两个菜单入口跳转，截图在 .codex/audits/avatar-message-entries/。当前验收账号均已读，截图未显示红点，未读显示与已读清除由回归测试覆盖。
