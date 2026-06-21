# 租户设置业务化布局设计

## 背景

当前租户设置页以表格展示后端设置项，用户看到的是 key、类型、当前值和操作。这适合开发排查，但不符合租户管理员的使用习惯。租户管理员需要直接操作业务功能点，例如选择默认楼栋、开关某项规则，而不是理解后端设置项如何存储。

已有设置体系已经将值类型和控件类型拆开：

- `value_type` 描述保存的数据类型。
- `widget` 描述默认渲染控件。
- `ui` 保存控件元数据。
- 前端已有 key 级自定义控件能力。

本设计在此基础上调整页面呈现，不引入新的表单搭建器。

## 目标

租户设置页改为业务功能点布局，不再向用户展示通用 key/value 表格。后端继续作为统一设置存储和覆盖机制，前端负责把设置项组织成用户可理解的业务分组。

## 后端模型

`DefaultSetting` 增加 `category` 字段，用来描述设置项所属业务类别。

```text
key: 唯一设置项，例如 property_rental.default_building_id
category: 业务类别，例如 property_rental
label: 用户可读名称，例如 默认楼栋
description: 设置说明
value_type: 值类型，例如 integer / text / boolean / json
widget: 默认控件，例如 select / input / switch / textarea
ui: 控件元数据，例如 options_source / placeholder / min / max
value: 默认值
```

后端不保存页面 section 标题、布局和卡片结构。业务分组标题和布局属于前端。

示例：

```json
{
  "key": "property_rental.default_building_id",
  "category": "property_rental",
  "label": "默认楼栋",
  "value": 10,
  "value_type": "integer",
  "widget": "select",
  "ui": {
    "options_source": "house.buildings"
  },
  "description": "新建房源时默认选择的楼栋"
}
```

## 前端结构

租户设置页按业务区块展示：

```text
租户设置
  房源租赁设置
    默认楼栋    [楼栋选择器] [保存] [恢复默认]
               [新建楼栋]

  通用设置
    未分类设置  [按 schema 渲染的控件] [保存] [恢复默认]
```

前端维护轻量注册表：

```ts
const organizationSettingSections = [
  {
    category: 'property_rental',
    title: '房源租赁设置',
    settingKeys: ['property_rental.default_building_id'],
  },
  {
    category: 'general',
    title: '通用设置',
  },
];

const customSettingControls = {
  'property_rental.default_building_id': DefaultBuildingSettingControl,
};
```

页面加载 `/api/settings/org/` 后：

1. 按 `category` 找到对应业务区块。
2. 区块内优先按 `settingKeys` 排序。
3. 未注册但同 category 的设置项追加到该区块末尾。
4. 没有 category 的设置项进入“通用设置”。

## 控件渲染

渲染优先级：

```text
setting.key 命中特殊业务组件
  -> 使用特殊组件

否则 widget/ui 可识别
  -> 使用通用 schema 控件

否则
  -> 回退 textarea
```

特殊业务组件只负责产出值，不直接保存设置：

```ts
type SettingControlProps = {
  setting: SettingWithSchema;
  value: unknown;
  onChange: (value: unknown) => void;
};
```

默认楼栋组件可以打开“新建楼栋”弹窗。新建成功后调用：

```ts
onChange(newBuilding.id);
```

它不调用 settings 保存接口。

## 保存流程

每个设置项由外层统一管理草稿值、保存、恢复默认、loading 和错误提示。

保存：

```text
PUT /api/settings/org/{key}/
{ value }
```

恢复默认：

```text
DELETE /api/settings/org/{key}/
```

自定义组件、schema 控件和 textarea 兜底都走同一套保存流程。

## 兼容策略

未适配设置项仍然可配置：

- 有 `category`：放进对应业务区块。
- 无 `category`：放进“通用设置”。
- 有已知 `widget`：按控件渲染。
- 无法识别：用 textarea 编辑。

不再保留表格页或高级 key/value 入口。

## 测试

最小测试覆盖：

1. 后端 API 返回 `category`。
2. 租户设置页按 `category` 渲染业务区块。
3. 默认楼栋 key 使用自定义组件。
4. 未注册 key 按 `widget` 渲染。
5. 未识别 widget 回退 textarea。
6. 保存统一调用 settings PUT。
7. 恢复默认统一调用 settings DELETE。

## 非目标

- 不引入 RJSF、Formily 或新的表单搭建器。
- 不让后端保存页面布局。
- 不保留面向用户的设置项表格。
- 不为每个设置项新增专用保存 API。
