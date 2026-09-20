# Codex 调用 Figma 生成设计稿：方式与边界调研

调研日期：2026-09-06

## 结论先行

面向 **Figma Design 中可编辑的 UI 设计稿**，当前 Codex + Figma 集成的主路径有两条；若把 FigJam 的图表也算作“设计产物”，则另有一条 `generate_diagram`。 

1. `use_figma`：Codex 将需求、现有代码或设计系统信息转为 Figma Plugin API 的 JavaScript，在目标文件里创建/更新原生节点、组件实例、变量和样式。这是从描述、代码或已有 Figma 稿生成可维护 UI 的默认方式。[S2][S3]
2. `generate_figma_design`：把正在运行的网页（本地或公网 URL）首次捕获为**可编辑 Figma Frame/设计图层**，并写入新文件、已有 Design 文件或剪贴板。网页首次入稿时应与 `use_figma` 并行：前者提供像素级视觉与图片参考，后者保留设计系统组件关系并生成更可维护的稿件。[S1][S2][S6]

`create_new_file` 不是第三种“生成 UI”的方式，而是上述两条路径在没有目标文件时的前置步骤：先创建空白 Figma 文件，再调用其中之一。[S4]

> 术语说明：本文的 `use_figma`、`generate_figma_design`、`create_new_file` 均为当前 Codex 会话已加载的 Figma MCP 工具名称；它们不是 Figma 公开 REST API 的同名端点。底层画布写入使用 Figma Plugin API，Figma 官方的 Plugin API `figma` 全局对象文档可见 [S5]。本机的 `figma-generate-design` 则是**技能（工作流说明）**，不是独立的 Figma MCP 工具或 API。[S2][S6]

## 方法总览

| 编号 | 入口与适用输入 | 生成物 | 最适合的场景 | 不适合/注意点 |
| --- | --- | --- | --- | --- |
| A | `use_figma` + 文字需求、页面结构说明、项目源码、Figma 文件 URL/`fileKey` | 原生、可编辑的 Frame、Auto Layout、文本、组件实例、变量、样式 | 从零设计页面；用代码或产品描述重建页面；调整已存在设计稿；建设组件/令牌 | 不是“传一个源码文件自动反编译”；Codex 会先理解代码/需求，再以 Plugin API 分步构建。 |
| B | `generate_figma_design` + 已运行网页（`localhost` 或公网） | 可编辑 Figma Frames/设计图层；在本机工作流中也作为像素级布局和图片参考 | 已有可访问 Web 页面，目标是尽量还原现状 | 只用于网页**首次捕获**；不应替代后续同步或纯设计稿编辑。 |
| C | A 与 B 并行，写入同一个 `fileKey` | 网页视觉保真 + 设计系统组件化的最终稿 | 从真实 Web 页面产出可交接 Figma UI，尤其页面有图片 | 当前集成明确要求：网页页面并行执行；页面含图片时此组合是强制工作流。 |
| D | `create_new_file`，随后接 A 或 B | 空白 Design / FigJam / Slides 文件 | 用户尚未提供目标 Figma 文件 | 只建文件，不自动产出 UI；创建需用户已认证的 Figma plan。 |
| E | `use_figma` + `search_design_system` / Code Connect 信息 | 基于既有库的屏幕或设计系统资产 | 已有发布的组件库，需要避免“看似相同、实际脱离库”的设计稿 | Code Connect 是代码与组件的映射/辅助发现，不是单独的“代码一键生成设计稿”引擎。 |
| F | `generate_diagram` + Mermaid 或自然语言 | 可编辑 FigJam 流程、架构、时序、状态、甘特或 ER 图 | 用户旅程、流程和架构表达 | 不是产品 UI 设计稿。 [S6][S12] |

## A. `use_figma`：从描述或代码生成原生 Figma 设计稿（默认）

这是最通用、也最接近“让 Codex 画设计稿”的路线。工具接收目标 `fileKey`、操作说明与 JavaScript；JavaScript 可使用 Figma Plugin API 在画布创建和修改节点。Figma 官方文档确认 Plugin API 暴露全局 `figma` 对象；当前集成则将此能力封装为 `use_figma`。[S3][S5]

### 可以怎样提供输入

- **纯描述**：例如“为租房 SaaS 设计一页移动端房源详情页，含图片轮播、价格、户型、咨询按钮”。Codex 应将描述拆成页面区段、组件与内容，再创建原生 Figma 节点。
- **代码仓库或指定页面源码**：例如“把 `frontend_admin` 的某个 React 页面写入 Figma”。Codex 先读取页面结构、所用组件、默认 props、字体与资源，再构建相应的 Figma 页面；它不是直接把 DOM 作为成品导入。[S2]
- **已有 Figma Design 文件 URL 或 `fileKey`**：将 URL 中的 `fileKey`（必要时还有 `node-id`）作为目标，先检查已有页面/组件/变量再更新，而不是重新创建另一份平行稿。[S2]

### 生成质量的关键做法

1. 先从 Code Connect、既有画面和设计库中查找组件、变量、文字/效果样式；然后导入并实例化，避免硬编码色值和间距。[S2][S6]
2. 分区构建并在每个区段后截图核验；复杂页面不要在一次 API 调用里堆完。当前技能要求每次返回所创建或变更的节点 ID，方便后续精确更新和验证。[S3]
3. 复用的视觉元素应做成组件或设计库实例；这才是“可交接、可更新”的设计稿，而不是一棵扁平的矩形树。[S2]

### 适用范围与限制

- `use_figma` 可写入 Figma Design、FigJam、Figma Slides；但 UI 设计稿通常应使用 `/design/` 文件。不同编辑器可用节点不同。[S3]
- 脚本写文字前必须加载目标字体；画布颜色通道使用 `0–1` 而不是 `0–255`。这些是 Plugin API 层面的典型限制。[S3][S5]
- 这是有状态的画布编辑：应先检查再增量修改；失败脚本是原子性的，先读错误再修正。[S3]

## B. `generate_figma_design`：从运行中的网页 URL 捕获

该路径针对的是**真实可访问的 Web 页面**，包括 `localhost` 开发服务器与公网网页。Figma 官方将它称为 Code to canvas：把浏览器中的 live UI 转为可编辑 Figma Frames/设计图层；可输出新文件、既有 Design 文件或剪贴板。[S6][S7]

在当前 Codex Figma connector 中，首次调用以 `fileKey` 换取捕获脚本和 `captureId`，随后以该 `captureId` 轮询完成状态。每个 `captureId` 只捕获一个页面；多页需分别发起捕获但可指向同一文件。[S1]

### 何时选择

- 需要快速获得与现有线上/本地 Web 界面高度一致的视觉参考；
- 页面包含真实图片、远程图片或复杂视觉资源；
- 要把现有 Web 界面纳入设计文件，同时再补足组件化结构。

### 重要限制

- **当前 Codex connector 先有目标文件**：本会话该工具要求已有 Figma **Design** 文件的 `fileKey`；不接受 `/slides/`、`/board/`（FigJam）或 `/make/` 作为目标。没有文件时先走 D。Figma 官方 Code to canvas 还支持输出到新文件或剪贴板，这是服务能力与本次 connector 调用约束的差异。[S1][S4][S7]
- **首次捕获专用**：当前工具说明明确规定：已捕获页面的更新/同步，以及非 Web 的 iOS、Android 或纯概念 UI，应改用 `use_figma`。[S1]
- **有体积与轮询约束**：捕获总大小（含序列化图片）上限为 50 MB；初始调用后每约 5 秒轮询，最多 10 次。[S1]
- **输出定位**：官方产物是可编辑图层；不过它的强项仍是视觉保真和资源进入文件。若页面还要与团队组件库、变量和样式保持关联，下节组合方式是本机技能给出的正式交付建议。[S2][S7]

## C. 推荐路径：网页捕获与 Plugin API 组件化并行

对于“从现有网页生成可编辑且可维护的 Figma 设计稿”，推荐在同一个 `fileKey` 上并行执行：

```text
运行中的 Web 页面
        │
        ├── generate_figma_design ──> 像素级捕获、图片 imageHash
        │
        └── use_figma ─────────────> 设计系统组件、变量、Auto Layout
                                         │
                                         ▼
                              对照捕获稿校准后的可编辑 UI
```

原因是两条路径互补：捕获结果提供准确的间距、尺寸、视觉处理与可复用的图片 hash；`use_figma` 生成的则是仍然关联设计系统组件的页面。完成图片转移与校准后，技能建议删除仅作参考的捕获输出。[S2]

如果源网页含 `<img>`、背景图、头像、产品图片或外链图，此组合不是可选优化而是当前技能的**强制流程**：`use_figma` 中的 Plugin API 不能直接拉取外部图片 URL，只能复用该 Figma 文件里已有节点的 `imageHash`。[S2]

## D. `create_new_file`：没有目标 Figma 文件时的启动方式

`use_figma` 与 `generate_figma_design` 都以既有 `fileKey` 为目标。用户没有提供文件时，先调用 `create_new_file`：

1. 取得用户可用 plan；若只有一个可自动选用，多个则须由用户指定；
2. 创建 `design`、`figjam` 或 `slides` 类型的空文件（UI 稿通常选 `design`）；
3. 取回 `file_key` 与 `file_url`，将 `file_key` 传给 A、B 或 C。[S4]

默认位置是该 plan 的 Drafts，也可指定 Figma 项目文件夹。这个步骤需要 Figma MCP 已连接及相应账户/计划的写权限。[S4]

## 共同前提、权限与非路径

- **必须使用 Remote MCP**：Figma 官方将 Remote server 描述为功能最完整的部署方式；Code to canvas 页进一步明确，本题的 `use_figma` 与 `generate_figma_design` 由 Remote server 提供，desktop server 不提供。Figma 官方安装说明已列出 Codex by OpenAI 为支持客户端，并给出 Codex App 的插件安装/OAuth 流程。[S7][S14]
- **写入权限不是自动具备**：使用 agent 写入 Figma 需要 Full seat；编辑既有文件还需要该文件的 edit permission。Code to canvas 对新建/个人 Drafts 与 Drafts 外既有文件的权限要求也分别说明。[S7]
- **REST API 不是替代方案**：Figma 官方的 API 对比页将 REST 定位为基本只读（变量、评论等少量例外），能实时编辑画布、创建 Frame/文字/层级的是 Plugin API。因此，不能把“调用 Figma REST API”列为 Codex 生成 UI 设计稿的第三条路径。[S15]
- **Figma Make 也不是此处的 MCP 写入入口**：官方 MCP 文档中的 Make 集成是把 Make 项目上下文带给 agent，用于后续代码工作；它没有作为把 Codex 内容直接写成 Figma Design UI 的工具列出。[S16]

## E. 从代码到设计系统：Code Connect 的位置

Code Connect 的本质是把设计组件与真实代码组件关联，方便 Dev Mode 和 AI/MCP 取得贴近生产环境的组件信息；它**不是**“把整个前端自动反向生成 Figma UI”的替代方案。Figma 官方说明将它描述为代码库与 Figma Dev Mode 之间的桥梁，并提供 UI 与 CLI 两种建立连接的方式。[S8]

但它会显著提升 A/C 的产物质量：当前屏幕生成技能会先在项目里寻找 `*.figma.ts`、`*.figma.js`、`*.figma.tsx` 或对应 Swift/Kotlin 映射，解析 Figma 组件 URL，取得组件 key，再通过 `use_figma` 导入实例。[S2]

使用 Code Connect 的前提是目标组件已发布到 Figma 团队库；当前插件技能还规定它需要 Organization 或 Enterprise 计划，以及带 `node-id` 的 Figma URL。[S8][S9]

## 容易混淆、但不属于 UI 设计稿主路径的能力

| 能力 | 实际用途 | 是否可替代 A/B/C |
| --- | --- | --- |
| `get_design_context` + `figma-design-to-code` | 从一个 Figma 节点读取上下文、截图和参考代码，方向为“设计 → 代码” | 否，方向相反。[S10] |
| `generate_deck` | 直接生成可编辑的 Figma Slides 演示文稿；工具明确不应用于网站/App UI 设计 | 否，只适合演示文稿。 [S11] |
| `generate_diagram` | 从 Mermaid 创建 FigJam 流程图、时序图、甘特图、状态图或 ER 图 | 否，工具明确不支持生成 Figma UI 设计。 [S12] |
| Weave 已发布工作流 | 运行用户已有的图像/视频/音频等工作流，取决于该工作流定义，且会消耗用户 Weave credits | 不应预设为 UI 设计稿生成器。 [S13] |

## 面向本仓库的选择建议

| 你的目标 | 建议路径 |
| --- | --- |
| 为尚未实现的管理端/小程序页面探索 UI | D → A：新建 `design` 文件，提供页面目标、用户流、信息层级和品牌/组件约束。 |
| 把 `frontend_admin/` 已运行的 React 页面做成可编辑 Figma 稿 | C：启动本地页面，先创建/指定 `design` 文件，再并行网页捕获与组件化构建。 |
| 更新已存在的 Figma 屏幕以匹配新代码 | A：检查现有节点并以 `use_figma` 增量更新；不要重新做首次网页捕获。 |
| 把项目组件库/主题沉淀为 Figma 库 | E：先建立/核对变量、组件与 Code Connect，再生成页面。 |
| 只需要流程、用户旅程或架构图 | `generate_diagram` 到 FigJam，不要误用 UI 生成路径。 |

## 实操提示词模板

### 从文字需求生成

> 在 Figma 的 `[文件 URL]` 中新建“房源详情”移动端页面。复用该文件的组件、变量和文字样式；页面需包含图片区、租金、单间户型、位置、设施和底部咨询按钮。先检查已有设计系统，逐段创建并截图核验。

### 从项目代码生成

> 阅读 `frontend_admin/src/...` 的页面与所依赖组件，将该页面写入 `[Figma 文件 URL]`。使用现有组件库/变量；不要把每个控件画成孤立矩形。若页面有真实图片，启动页面后并行捕获 `localhost` 页面作为视觉和图片参考，最终保留组件化版本。

### 从网页 URL 生成

> 将 `http://localhost:xxxx/path` 首次捕获到 `[Figma Design 文件 URL]`，并同时按该文件的设计系统用原生组件重建。捕获仅作像素与图片参考，完成后将图片 hash 转移到组件化页面并删除参考捕获。

## 来源与核验范围

以下来源均为 Figma 官方开发/帮助资料，或本机已安装的 Figma 插件与本会话 MCP schema；未采用第三方教程或转述文章。

- **[S1]** 当前会话的 Figma MCP `generate_figma_design` 工具 schema（Figma connector，2026-09-06 检索）：用途、`fileKey`/`captureId`、首次捕获、50 MB、轮询与目标 URL 限制。
- **[S2]** [已安装 Figma 插件 v2.0.21：`figma-generate-design` 技能](</Users/lan/.codex/plugins/cache/openai-curated-remote/figma/2.0.21/skills/figma-generate-design/SKILL.md>)：页面/代码/描述到 Figma、与捕获工具并行、设计系统发现、图片 hash 转移及更新规则。
- **[S3]** [已安装 Figma 插件 v2.0.21：`figma-use` 技能](</Users/lan/.codex/plugins/cache/openai-curated-remote/figma/2.0.21/skills/figma-use/SKILL.md>)：`use_figma` 的 Plugin API 写入能力、支持的编辑器、增量和验证规则。
- **[S4]** [已安装 Figma 插件 v2.0.21：`figma-create-new-file` 技能](</Users/lan/.codex/plugins/cache/openai-curated-remote/figma/2.0.21/skills/figma-create-new-file/SKILL.md>)：plan 解析、文件类型、Drafts、返回 `file_key`/`file_url`。
- **[S5]** [Figma Developers：Plugin API 的 `figma` 全局对象](https://developers.figma.com/docs/plugins/api/figma/)：底层 Plugin API 的一手 API 说明。
- **[S6]** [Figma Developers：Figma MCP server 的工具与提示词](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/)：`use_figma`、`generate_figma_design`、`generate_diagram` 等官方工具的定位和产物边界。
- **[S7]** [Figma Developers：Code to canvas](https://developers.figma.com/docs/figma-mcp-server/code-to-canvas/)：运行中 UI 到可编辑 Figma Frames、写入方式、权限和 Remote server 限制。
- **[S8]** [Figma Help：Code Connect](https://help.figma.com/hc/en-us/articles/23920389749655-Code-Connect)：Code Connect 的定位、UI/CLI 两种连接方式、与 MCP 的关系及计划要求。
- **[S9]** [已安装 Figma 插件 v2.0.21：`figma-code-connect` 技能](</Users/lan/.codex/plugins/cache/openai-curated-remote/figma/2.0.21/skills/figma-code-connect/SKILL.md>)：当前 Codex 工作流对已发布组件、计划与带 `node-id` URL 的要求。
- **[S10]** [已安装 Figma 插件 v2.0.21：`figma-design-to-code` 技能](</Users/lan/.codex/plugins/cache/openai-curated-remote/figma/2.0.21/skills/figma-design-to-code/SKILL.md>)：`get_design_context` 的方向是从 Figma 到代码。
- **[S11]** 当前会话的 Figma MCP `generate_deck` 工具 schema（Figma connector，2026-09-06 检索）。
- **[S12]** 当前会话的 Figma MCP `generate_diagram` 工具 schema（Figma connector，2026-09-06 检索）。
- **[S13]** 当前会话的 Figma MCP `weave_*` 工具 schema（Figma connector，2026-09-06 检索）。
- **[S14]** [Figma Developers：Remote MCP server 安装](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/)：Remote endpoint、支持客户端及 Codex 安装说明。
- **[S15]** [Figma Developers：Compare APIs](https://developers.figma.com/compare-apis/)：REST API 与 Plugin API 的读写能力范围。
- **[S16]** [Figma Developers：将 Figma Make 上下文带入 agent](https://developers.figma.com/docs/figma-mcp-server/bringing-make-context-to-your-agent/)：Make 与 MCP 集成的方向与边界。
