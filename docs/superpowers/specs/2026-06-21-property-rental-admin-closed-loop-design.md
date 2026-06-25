# 房源租赁管理端闭环重构设计

## 目标

`frontend_admin` 的房源租赁模块按运营后台最佳实践重构，不再迁就当前单页 CRUD。管理端要覆盖房源从建档、完善、发布、带看、签约、履约到归档的完整生命周期，并提供比未来移动端更完整的维护能力。

第一阶段直接废弃旧的 `frontend_admin/src/pages/property-rental/index.tsx` 页面结构，旧文件只作为字段和 API 调用参考。

## 现状

- 当前 `property-rental/index.tsx` 把项目、楼栋、联系人、房源、带看、租约都塞在一个页面和多个弹窗里。
- 房源创建是普通弹窗表单，缺少流程引导，也不能在流程中顺手新建项目、楼栋、房东。
- 图片、视频、合同上传只使用 antd `Upload` 文件列表，没有相册预览、排序、封面、角色标记和持续维护入口。
- 后端已有 `MediaRefsField`，`Estate.images`、`House.images`、`House.videos`、`Lease.contract_files` 能保存稳定媒体引用和业务元数据，并通过 resolved 属性回显 `url`、`thumbnail`、`file_size` 等派生字段。

## 推荐方案

采用目标态重构：房源是聚合中心，列表负责发现问题，详情负责解决问题。

不做兼容层，不保留旧单页作为正式入口。不先做泛用媒体库；媒体能力放在房源详情、创建向导和媒体待办里闭环。

## 信息架构

`/property-rental` 作为房源租赁业务域，拆成以下路由：

- `/property-rental/workbench`：运营工作台
- `/property-rental/houses`：房源列表
- `/property-rental/houses/new`：新建房源向导
- `/property-rental/houses/:id`：房源详情
- `/property-rental/estates`：项目与楼栋管理
- `/property-rental/contacts`：房东与租客联系人管理
- `/property-rental/viewings`：带看管理
- `/property-rental/leases`：租约管理

默认入口为 `/property-rental/workbench`，但房源列表和房源详情是最高频工作区。

## 生命周期闭环

房源主线：

1. 建档：项目、楼栋、房源基础、房东。
2. 完善：图片、视频、户型图、描述、标签、租金和内部备注。
3. 发布：发布检查、上架、下架。
4. 转化：带看预约、带看结果、成交来源。
5. 履约：租约、合同、租期、押金、付款日、状态流转。
6. 归档：退租、历史记录、下架归档。

挂牌信息和租约信息分离：房源发布前需要维护挂牌租金、押金规则和可租日期；租约保存实际成交租金、押金、租期和合同。

## 状态模型

状态必须分离，避免把所有生命周期塞进一个 `status`。

- `House.status` 继续表达租赁房态：空置、已租、装修中、锁定。
- 新增房源发布状态 `publish_status`：草稿、已发布、已下架。
- 资料完整度和媒体完整度用于运营提示；列表筛选通过 `GET /api/house/houses/?publish_issue=<issue>` 在后端分页前完成。
- `ViewingRecord.status` 继续表达预约、已看、取消、爽约、成交。
- `Lease.status` 继续表达待生效、生效中、已到期、已终止。

发布状态和租赁房态互不替代：已发布房源可以是空置，草稿房源也可以已有房东和媒体。

租约状态变更要反向维护房态：租约生效后房源变为已租；租约到期或终止后，若没有其他生效租约，房源回到空置。锁定和装修中房态需要人工解除，不被租约自动覆盖。

租约列表对合法下一状态提供行级操作，常规履约不需要先打开编辑抽屉再手选状态。

## 运营工作台

工作台以待办为中心，不先做大屏图表。

第一阶段待办：

- 待补房东
- 待补租金
- 待补封面
- 图片少于最低数量
- 缺户型图
- 今日带看
- 已成交待签约
- 合同缺失
- 租约即将到期
- 空置超过 30 天

待办点击后进入对应房源详情或列表筛选结果。媒体待办先放在工作台和房源列表筛选里，不单独做页面。

已成交待签约进入 `/property-rental/viewings?pending_lease=true`，带看列表由后端过滤出已成交且尚未创建来源租约的记录，并提供“签约”入口；签约入口进入 `/property-rental/leases?source_viewing_record_id=<id>`，租约页自动打开新建租约抽屉并带入成交带看来源。

合同缺失进入 `/property-rental/leases?task=contract`，租约列表传 `contract_missing=true`，由后端在分页前过滤。

## 房源列表

房源列表是发现问题的入口，需要展示：

- 封面缩略图
- 项目、楼栋、房号
- 房态和发布状态
- 面积、户型、朝向、装修
- 挂牌租金和可租日期
- 房东
- 媒体完整度
- 最近带看
- 当前租约
- 快捷动作：进入详情、新建带看、改房态、发布检查

列表支持按项目、楼栋、房态、发布状态、媒体缺口、房东缺失、租约状态筛选。工作台跳转的房源待办使用 `publish_issue` 参数，避免只过滤当前分页数据。

所有房源、楼栋选择项都必须带足上下文：房源显示为“项目 / 楼栋 / 房号”，楼栋显示为“项目 / 楼栋”。不要只显示房号或楼栋名，避免多项目同名数据误选。

## 房源详情

房源详情是核心管理中心。

顶部摘要：

- 封面
- 项目、楼栋、房号
- 房态
- 发布状态
- 面积和户型
- 房东
- 媒体完整度

右侧动作区：

- 编辑基础资料
- 改房态
- 发布检查
- 上架或下架
- 登记带看
- 创建租约

详情 Tabs：

- 基础资料
- 媒体相册
- 房东联系人
- 带看记录
- 租约合同
- 内部备注

## 新建房源向导

新建房源使用分步向导：

1. 项目与楼栋：选择已有项目/楼栋；缺失时在当前步骤 inline 新建。
2. 房源基础：房号、楼层、面积、户型、朝向、装修、电梯、挂牌租金、押金规则、可租日期。
3. 房东：选择已有联系人；缺失时 inline 新建房东。
4. 媒体：上传图片和视频，设置封面和角色，可跳过。
5. 确认：保存草稿，或通过发布检查后发布。

草稿最低要求：项目/楼栋和房号。

发布要求：

- 已绑定房东
- 已填写挂牌租金
- 有封面图
- 至少 3 张房源图片
- 有户型图

检查失败时给出明确缺口，并跳转到房源详情对应 Tab。

## MediaRefsUpload

新增一个房源域内通用的 `MediaRefsUpload` 组件，用于项目图片、房源图片、房源视频和租约合同。

图片能力：

- 网格预览
- 大图预览
- 拖拽排序
- 设置封面，按钮文案保持短句，具体文件名只放在无障碍名称里，避免相册操作区被长文件名撑开
- 设置角色：封面、客厅、卧室、厨房、卫生间、阳台、户型图、楼栋/外观
- 替换
- 删除
- 上传进度和失败重试

视频能力：

- 文件预览或播放
- 排序
- 替换
- 删除
- 上传进度和失败重试

合同文件能力：

- 文件名、大小、上传状态
- 预览或下载
- 替换
- 删除

合同当前后端最多 1 份，不做排序。

提交结构继续使用 `MediaRefsField`：

```json
[
  {
    "media_id": 3001,
    "media_type": "image",
    "label": "客厅",
    "image_role": "living_room"
  }
]
```

数组顺序就是排序。`url`、`thumbnail`、`file_size`、`created_at` 等派生字段只用于回显，不写回后端。

## 数据与接口

继续使用手写 `houseApi` 和媒体上传接口，但按目标态补齐必要能力。

实现计划必须处理：

- `House.publish_status`
- `House.asking_rent`、`House.deposit_amount`、`House.available_from`
- 房源发布和下架的 PATCH 能力
- 房源列表支持 `estate_id` 和 `building_id` 筛选，先按项目收窄，再按楼栋定位
- 房源详情先用现有详情、列表和按 `house_id` 筛选接口组合；性能或分页体验不够时再补聚合接口
- 楼栋列表的 `q` 搜索必须同时匹配楼栋名、所属项目名和所属项目展示名，保证项目楼栋页的统一搜索不会让关联楼栋误消失
- 表格行内原地动作使用按钮语义；只有真实导航才使用链接，不能用无 `href` 的 `<a>` 或 `href="#"` 模拟按钮
- 工作台先用现有列表数据计算待办；房源待办落到列表页时必须传 `publish_issue`，由后端过滤后分页
- 带看、租约、联系人在详情页的按房源筛选能力
- 已成交待签约待办落到带看列表页时必须传 `pending_lease=true`，由后端过滤已成交且未签约记录后分页
- 合同缺失待办落到租约列表页时必须传 `contract_missing=true`，由后端过滤后分页
- 租约生效、到期、终止时的房态同步规则

不新增独立媒体库接口。媒体治理先围绕房源引用完成。

## 组件边界

建议拆分：

- `pages/property-rental/layout.tsx`：业务域布局
- `pages/property-rental/workbench.tsx`
- `pages/property-rental/houses/index.tsx`
- `pages/property-rental/houses/new.tsx`
- `pages/property-rental/houses/detail.tsx`
- `pages/property-rental/estates/index.tsx`
- `pages/property-rental/contacts/index.tsx`
- `pages/property-rental/viewings/index.tsx`
- `pages/property-rental/leases/index.tsx`
- `pages/property-rental/components/MediaRefsUpload.tsx`

如果实现时文件过大，再继续拆局部组件。不要提前做复杂状态管理层；React Query 和表单本地状态足够。

## 错误处理

- 上传失败保留文件卡片状态，允许重试或删除。
- 保存失败保留表单和媒体选择，不清空用户输入。
- 发布检查失败展示缺口列表，并提供跳转。
- 后端媒体校验失败时显示资源类型或媒体类型错误。
- inline 新建项目、楼栋、房东失败时只阻断当前步骤，不丢失其他步骤数据。

## 测试

前端单测覆盖：

- `MediaRefsUpload` 排序后输出顺序正确
- 设置封面后只有一个 `image_role=cover`
- 派生字段不会写入提交值
- 向导最低草稿字段校验
- 发布检查缺口提示

后端测试覆盖：

- `publish_status` 默认草稿
- 发布状态和租赁房态互不污染
- 发布检查所依赖字段可被 PATCH 保存
- 租约生效、到期、终止时按规则同步房态
- 媒体引用仍按 `MediaRefsField` 校验、清洗和保持顺序

## 非目标

- 不做通用媒体资产库。
- 不做移动端页面。
- 不做复杂 BI 大屏。
- 不做操作日志。
- 不为了兼容旧 `property-rental/index.tsx` 保留适配层。
