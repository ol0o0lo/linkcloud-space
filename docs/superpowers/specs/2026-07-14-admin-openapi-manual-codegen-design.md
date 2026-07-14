# 管理端 OpenAPI 改为手动生成

## 目标

避免 `frontend_admin` 在日常开发启动和构建时加载 OpenAPI 代码生成插件；仅在开发者显式执行 `npm run openapi` 时生成 API 客户端代码。

## 设计

- 在 `frontend_admin/config/config.ts` 中，以 `OPENAPI_CODEGEN=true` 作为加载 `@umijs/max-plugin-openapi` 的唯一条件。
- 保留现有 `openAPI` 配置，使手动生成时继续使用项目现有的后端与 allauth schema、标签转换及输出目录。
- 修改 `frontend_admin/package.json` 的 `openapi` 命令，通过已有的 `cross-env` 设置 `OPENAPI_CODEGEN=true`，然后执行既有预处理和 `max openapi` 流程。

## 行为

- `npm run dev`、`npm run start` 与 `npm run build`：不加载 OpenAPI 插件，不进行 API 客户端生成。
- `npm run openapi`：加载插件，下载并转换两个 schema，再生成 `src/services/openapi` 和 `src/services/allauth`。

## 验证

通过 TypeScript 配置检查或管理端 lint，确认条件化插件数组不影响正常配置解析；检查 `npm run openapi` 脚本已设置所需环境变量。无需重新生成 API 文件。
