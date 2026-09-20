# 小程序业务页面字号治理设计

## 目标

治理小程序业务页面模板中的任意数字字号类，例如 `text-21rpx`、`text-22rpx` 和 `text-35rpx`。改造后统一使用 UnoCSS 已有的命名字号阶梯，减少视觉层级漂移，并让字号自带一致、合理的行高。

本次不新增 `app-type-*` 等项目自定义语义类，也不引入文字包装组件。

## 范围

包含：

- `frontend_miniprogram/src/pages-org-admin/`
- `frontend_miniprogram/src/pages-org-work/`
- `frontend_miniprogram/src/pages-org-rental/`
- `frontend_miniprogram/src/pages-personal-rental/`
- `frontend_miniprogram/src/pages-landlord/` 中采用 UnoCSS 的业务模板
- `frontend_miniprogram/src/pages/account/` 中的钱包、推荐等业务模板
- 上述页面直接依赖的 `components/app/` 与业务子目录组件

不包含：

- `components/house/`、公开房源展示页等以及其他定制视觉页面
- Vue `<style>`、SCSS、CSS 中现有的 `font-size`
- Wot UI 组件内部字号和已有的组件 CSS 变量覆盖
- 间距、圆角等非字号任意值

## 字号阶梯

业务模板只使用以下阶梯：

| 类名 | H5 字号 | 小程序等价值 | 默认用途 |
| --- | ---: | ---: | --- |
| `text-2xs` | 10px | 20rpx | 极弱辅助信息、紧凑计数 |
| `text-xs` | 12px | 24rpx | 时间、元数据、说明文字 |
| `text-sm` | 14px | 28rpx | 正文、表单说明、常规列表文字 |
| `text-base` | 16px | 32rpx | 卡片标题、重要正文 |
| `text-lg` | 18px | 36rpx | 详情标题、区块主标题 |
| `text-xl` | 20px | 40rpx | 重点金额、业务指标 |
| `text-2xl` | 24px | 48rpx | 少量核心金额或核心指标 |
| `text-3xl` | 30px | 60rpx | 极少数总览核心数字 |

`text-2xs` 已由项目配置为 `20rpx / 28rpx`。其余字号使用 UnoCSS 内置值及其配套行高。业务页面不使用不存在的 `text-md`，中等基础字号统一使用 `text-base`。

## 迁移规则

迁移不只按原数字就近替换，还要根据内容角色确认层级。默认映射如下：

| 旧值 | 默认新类 |
| --- | --- |
| `19rpx`～`21rpx` | `text-2xs` |
| `22rpx`～`25rpx` | `text-xs` |
| `26rpx`～`29rpx` | `text-sm` |
| `30rpx`～`32rpx` | `text-base` |
| `35rpx`～`38rpx` | `text-lg` |
| `40rpx`～`44rpx` | `text-xl`，核心金额可使用 `text-2xl` |
| `58rpx` | `text-3xl` |

同一信息角色在不同页面必须收敛到同一阶梯。例如时间和元数据统一为 `text-xs`，普通正文统一为 `text-sm`，详情标题统一为 `text-lg`。

图标通过 `text-*` 控制尺寸时也使用上述标准阶梯，不再保留 `text-42rpx` 等任意值。

## 字重与行高

字号类自带默认行高，因此迁移时移除仅用于弥补任意字号的 `leading-*`。长段正文确实需要更舒展的排版时，可以保留经过确认的行高类。

与字号同时出现的数字字重按等价名称清理：

- `font-400` → `font-normal`
- `font-500` → `font-medium`
- `font-600` → `font-semibold`
- `font-700` → `font-bold`

文字颜色继续使用现有语义类，例如 `text-content-primary`、`text-content-secondary`、`text-content-muted` 和 `text-app-price`，不纳入本次变更。

## 约束与验收

新增一个轻量静态检查，扫描本次范围内 Vue 模板的 class 字符串，禁止出现 `text-<数字>rpx` 和 `text-<数字>px`。标准类如 `text-xs`、`text-sm`、`text-base`、`text-2xl` 不受影响。

验收条件：

1. 范围内业务模板不再包含任意数字字号类。
2. 相同信息角色的字号保持一致。
3. H5 和微信小程序构建均能识别标准字号类。
4. 现有 Wot UI 组件字号、定制房源视觉和 SCSS 样式不受影响。
5. 静态检查能够阻止后续重新引入任意数字字号类。

## 实施顺序

1. 确认并保留 `text-2xs` 项目扩展，移除未使用且不必要的更小字号扩展。
2. 按信息角色迁移共享业务组件，再迁移各业务页面。
3. 清理对应的数字字重和多余行高类。
4. 添加静态检查并运行现有前端测试、类型检查和 H5/微信小程序构建验证。
