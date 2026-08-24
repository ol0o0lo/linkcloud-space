# Workbench Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工作台页头切换器改为已确认的图标按钮组视觉样式。

**Architecture:** 继续复用 Ant Design `Segmented` 与现有路由状态，只调整页面私有 `createStyles` 规则。这样保留组件的键盘交互、无障碍语义和现有业务行为。

**Tech Stack:** React 19、Ant Design 6、antd-style 4、TypeScript

---

### Task 1: 调整工作台切换器样式

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [x] **Step 1: 查询当前 Segmented 组件信息**

```bash
nvm use 22 && npm --prefix frontend_admin exec -- antd info Segmented
```

Expected: 输出当前 Ant Design 版本中 `Segmented` 的 API 与用法信息。

- [x] **Step 2: 实现图标按钮组样式**

在 `workbenchSwitcher` 中将外层改为透明布局，为 `.ant-segmented-item-icon` 设置 30px 圆角图标容器，并通过 `.ant-segmented-thumb`、`.ant-segmented-item-selected` 实现浅蓝选中背景、蓝色边框和蓝底白色图标。

- [x] **Step 3: 保留窄屏等宽布局**

在现有 `max-width: 575px` 媒体查询中让 group 与 item 填满可用宽度，并保持标签居中。

- [x] **Step 4: 运行管理端静态检查**

```bash
nvm use 22 && npm --prefix frontend_admin run lint
```

Expected: Biome 与 TypeScript 检查通过；若存在改动前已存在的问题，单独记录，不修改无关文件。

> 按项目要求，本计划不执行 Git 提交。
