# Startup Branch Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为仓库建立 `startup` 模板分支的最小可执行治理方案，并在仓库内留下可复用说明。

**Architecture:** 本次实现不修改业务代码，只新增文档并创建一个新的 Git 分支。通过仓库内文档约束 `main` 与 `startup` 的职责边界，降低后续模板回灌时把当前项目业务代码带回模板分支的风险。

**Tech Stack:** Git、Markdown、现有仓库文档目录结构

---

### Task 1: 编写模板分支治理文档

**Files:**
- Create: `docs/startup-branch.md`
- Test: `git diff -- docs/startup-branch.md`

- [ ] **Step 1: 写文档草稿**

```md
# startup 分支说明

## 目标
- `main` 用于当前项目持续开发
- `startup` 用于新项目启动模板

## 分支职责
- `main` 可以包含当前项目业务代码与定制配置
- `startup` 只保留可复用基础设施与通用能力

## 回灌规则
- 不将 `main` 整体合并回 `startup`
- 只回灌经过确认的通用提交
```

- [ ] **Step 2: 检查文档差异**

Run: `git diff -- docs/startup-branch.md`
Expected: 显示新增文档内容，包含目标、边界、回灌规则、新项目使用流程。

- [ ] **Step 3: 视需要补全文档细节**

```md
## 禁止进入 startup 的内容
- 当前项目品牌、文案、客户特有流程

## 建议保留在 startup 的内容
- 认证、组织、多租户、通知、Docker、测试基建
```

### Task 2: 创建 startup 分支

**Files:**
- Modify: `.git` 引用（Git 分支元数据）
- Test: `git branch --list startup`

- [ ] **Step 1: 从当前 HEAD 创建分支**

```bash
git branch startup
```

- [ ] **Step 2: 验证分支已存在**

Run: `git branch --list startup`
Expected: 输出 `startup`

- [ ] **Step 3: 确认不切换当前工作分支**

```bash
git status --short --branch
```

Expected: 仍停留在当前工作分支，且保留原有未提交改动。

### Task 3: 最小验证与交付说明

**Files:**
- Test: `git status --short --branch`
- Test: `git diff -- docs/startup-branch.md`

- [ ] **Step 1: 验证当前分支状态**

Run: `git status --short --branch`
Expected: 当前仍是 `main`，并能看到原本未提交改动；新增文档以未跟踪或已修改形式出现。

- [ ] **Step 2: 验证新增文档可读**

Run: `sed -n '1,220p' docs/startup-branch.md`
Expected: 文档内容完整，包含职责边界、回灌策略、启动新项目流程。

- [ ] **Step 3: 交付说明**

```md
- 已创建 `startup` 分支
- 已新增模板分支治理文档
- 当前未提交改动未被改写或回滚
```
