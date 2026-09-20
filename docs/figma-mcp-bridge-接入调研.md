# Figma MCP Bridge 接入调研

调研日期：2026-09-06。本文仅依据该项目公开 README、发布产物和源代码整理；它不是 Figma 官方 MCP。

## 结论

`gethopp/figma-mcp-bridge` 是一个本机桥接方案：将一个需要手动导入到 Figma 的开发插件，通过 `ws://localhost:1994/ws` 连接到由 MCP 客户端启动的本地 Node 服务。它调用 Figma 插件 API，而不是 Figma REST API；因此不消耗 Figma REST API 限流额度，但**不代表没有任何 Figma 计划、编辑权限或插件使用限制**。[README](https://github.com/gethopp/figma-mcp-bridge#readme)；[插件 manifest](https://github.com/gethopp/figma-mcp-bridge/blob/main/plugin/manifest.json)。

当前可提供读取图层、选区、样式、变量、导出截图等能力，也包含创建页面/Frame/文本/形状、修改文本和样式、删除节点等写入工具。写入只能在 Figma **设计编辑器**中执行，Dev Mode 会被插件显式拒绝；目标文件还要求当前用户具备编辑权限。[可用工具与编辑说明](https://github.com/gethopp/figma-mcp-bridge#available-tools)；[写入模式校验源码](https://github.com/gethopp/figma-mcp-bridge/blob/main/plugin/src/main/code.ts)。

## 必要前置条件

1. 已安装 Node.js 20 或更高版本（服务包声明 `node >=20`）。[server/package.json](https://github.com/gethopp/figma-mcp-bridge/blob/main/server/package.json)
2. 可运行 `npx`，并能访问 npm；首次运行会下载包。 
3. Figma Desktop 或能使用开发插件导入的 Figma 环境；打开目标设计文件，并对需要写入的文件拥有编辑权限。
4. `localhost:1994` 未被其他程序占用。桥服务默认监听该端口，且允许通过 `FIGMA_BRIDGE_PORT` 覆盖；插件端点必须与构建时的 manifest 白名单匹配。[服务入口](https://github.com/gethopp/figma-mcp-bridge/blob/main/server/src/index.ts)；[UI WebSocket 实现](https://github.com/gethopp/figma-mcp-bridge/blob/main/plugin/src/ui/App.tsx)。

## 安装与连接步骤

### 1. 注册 Codex 本地 MCP 服务

可用 Codex CLI 的等价命令注册（会写入用户级 `~/.codex/config.toml`）：

```bash
codex mcp add figma-bridge -- npx -y @gethopp/figma-mcp-bridge@0.0.21
```

也可以在 `~/.codex/config.toml` 配置：

```toml
[mcp_servers.figma-bridge]
command = "npx"
args = ["-y", "@gethopp/figma-mcp-bridge@0.0.21"]
```

上面的 Codex CLI 语法由本机 `codex mcp add --help` 验证。版本固定为最新 GitHub Release `v0.0.21`，避免 README 的 `@latest` 在后续自动升级为未审查版本。[Release v0.0.21](https://github.com/gethopp/figma-mcp-bridge/releases/tag/v0.0.21)；[README 的 `npx` 示例](https://github.com/gethopp/figma-mcp-bridge#quick-start)。

本机检查发现上述 `figma-bridge` 配置已存在，且已固定为 `@0.0.21`；此次调研未改动该配置。

### 2. 下载并导入 Figma 开发插件

1. 从 [v0.0.21 发布页](https://github.com/gethopp/figma-mcp-bridge/releases/tag/v0.0.21) 下载 `figma-mcp-bridge-v0.0.21.zip` 并解压。
2. Figma 菜单进入 **Plugins → Development → Import plugin from manifest**。
3. 选择解压目录 `plugin/manifest.json`。
4. 在目标 Figma 文件、**Design** 模式下运行 `Figma MCP Bridge` 插件，插件界面显示 `WebSocket Connected` 后再让 Codex 使用工具。

仓库 README 明确要求从 Release 下载插件，再导入 `plugin/manifest.json`。[官方 README 安装段](https://github.com/gethopp/figma-mcp-bridge#quick-start)。一次可在多个 Figma 文件中分别运行插件；使用 MCP 的 `list_files` 获取 `fileKey`，之后在其他工具调用中指定它。[多文件路由源码](https://github.com/gethopp/figma-mcp-bridge/blob/main/server/src/bridge.ts)。

## 权限、数据和风险

- **第三方开发插件：** 它不是 Figma 官方托管插件。导入 Release 中的 `manifest.json` 前，应由用户确认。插件 `manifest` 申请动态页文档访问，网络访问白名单是 `ws://localhost:1994`，且没有额外 `permissions`。[manifest](https://github.com/gethopp/figma-mcp-bridge/blob/main/plugin/manifest.json)
- **本机无鉴权桥接：** 当前源代码在本机 1994 端口暴露 `/ws`、`/ping`、`/rpc`，没有 token 或认证检查；虽然 intended endpoint 是 localhost，但不应把该端口转发/暴露给局域网或公网，也不应在不可信的本机进程环境中运行。[leader 实现](https://github.com/gethopp/figma-mcp-bridge/blob/main/server/src/leader.ts)；[WebSocket 实现](https://github.com/gethopp/figma-mcp-bridge/blob/main/server/src/bridge.ts)
- **可造成设计稿写入：** 除读取外，服务器公开创建、修改、重排、分组和删除图层等工具；`delete_nodes` 虽要求 `confirm: true`，其他改动工具没有相同二次确认。应先只允许读取/截图，写入时限定文件与页面，并在每批写入后复核。[工具列表](https://github.com/gethopp/figma-mcp-bridge#available-tools)。
- **本地文件与外部 URL：** `create_image` 可读取本机路径或拉取远程 URL；`save_screenshots` 可写入本地文件。不要让不可信提示词决定路径、URL 或导出目录。[README 编辑说明](https://github.com/gethopp/figma-mcp-bridge#editing-notes)；[工具实现](https://github.com/gethopp/figma-mcp-bridge/blob/main/server/src/tools.ts)。
- **供应链与稳定性：** 包为 MIT 许可且明确按“AS IS”提供；使用 `npx -y` 会执行从 npm 拉取的包。建议始终固定已审核版本，升级前查看 Release diff 并重新导入对应版本插件。[LICENSE](https://github.com/gethopp/figma-mcp-bridge/blob/main/LICENSE.md)。

## 建议的启用策略

先由用户在 Figma 手动完成“下载、解压、导入第三方开发插件”这一授权敏感步骤；随后只验证 MCP 是否可列出当前文件和读取选区。确认连接与内容范围无误后，再按页面/Frame 小批量执行写入操作。这样可以绕开官方 Remote MCP 的调用配额，但不会绕过 Figma 文件编辑权限。
