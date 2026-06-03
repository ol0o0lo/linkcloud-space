# 前端工程结构

本仓库采用“同仓多工程、依赖隔离”的组织方式。后端、SaaS 管理后台和小程序端放在同一个 Git 仓库中，方便接口、权限和业务流程一起变更；各前端工程仍保留自己的依赖、lockfile、构建链和发布节奏。

## 目录职责

- `frontend/`：Django 模板自带的 Vue SPA。当前只作为过渡位置保留，后续业务迁移完成后可以下线。
- `frontend_admin/`：SaaS 管理后台。该目录内部已经是独立的 `pnpm workspace` / `turbo` 工程，应继续在目录内维护自己的 `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 和内部包结构。
- `frontend_miniprogram/`：小程序端工程。该目录使用 uni-app / unibest 体系，应继续维护自己的 `package.json`、lockfile、平台构建配置和发布脚本。

## 边界约定

- 根目录不新增顶层 `pnpm-workspace.yaml` 来统一管理所有前端依赖。
- 不共享根目录 `node_modules`，也不让 `frontend_admin/` 和 `frontend_miniprogram/` 共用依赖安装目录。
- 不从一个前端工程直接 import 另一个前端工程的源码。
- 跨端共享的业务契约优先来自后端 API、OpenAPI schema、权限枚举、接口文档或生成代码。
- 跨端确实需要共享的前端代码，应先确认它是稳定业务契约，再考虑独立生成物或独立包；不要为了复用少量工具函数提前引入顶层 workspace。

## 常用入口

根目录提供统一的 `just` 入口，便于日常开发时不用记住每个子工程的脚本细节。

```bash
just admin_dev              # 启动 SaaS 管理后台开发服务
just admin_build            # 构建 SaaS 管理后台，并收集到 Django 静态文件
just miniprogram_dev        # 启动微信小程序开发构建
just miniprogram_build      # 构建微信小程序产物
just miniprogram_build_h5   # 构建小程序 H5 产物，并收集到 Django 静态文件
```

如果需要执行更细的平台命令，进入对应目录后使用该工程自己的脚本：

```bash
cd frontend_admin && pnpm run
cd frontend_miniprogram && pnpm run
```

## 演进原则

当前结构适合后端、管理后台和小程序端在同一个业务仓库中协作，但不把它们合并成统一依赖的顶层前端 monorepo。只有当多个前端长期共享稳定的 API client、类型、权限模型或设计 token，并且共享收益明显高于依赖耦合成本时，才考虑进一步抽取公共生成物或公共包。
