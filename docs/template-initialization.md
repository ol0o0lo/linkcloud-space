# 模板初始化与改名指南

本文说明如何把当前模板安全地初始化为一个新项目。

## 推荐流程

1. 确认当前分支和工作区：

```bash
git status --short --branch
```

2. 先列出需要替换的项目身份：

- 项目 slug，例如 `my-new-project`
- 显示名称，例如 `My New Project`
- 仓库地址，例如 `your-org/my-new-project`
- Docker 镜像名
- 数据库名和 Redis 前缀
- 站点标题、首页文案、品牌文案

3. 按文件逐项替换，不做全仓库盲替换。

4. 重新生成 `.env`：

```bash
just create_env
```

5. 做基础验证：

```bash
just test
just lint
```

如果影响启动链路，再执行：

```bash
just start
```

## 建议优先检查的文件

初始化新项目时，建议优先检查这些文件：

- `pyproject.toml`
- `package.json`
- `justfile`
- `compose.yml`
- `config/mkdocs.yml`
- `config/api.py`
- `config/settings/_base.py`
- `config/docker/Dockerfile.web`
- `config/docker/Dockerfile.bun`
- `frontend/js/views/HomeView.vue`
- `.env.example`

常见需要替换的内容：

- 项目 slug，例如 `django-base-site`、`linkcloud-space`
- 显示名称，例如 `Django Base Site`
- GitHub 仓库标识，例如 `epicserve/django-base-site`

不要把历史计划文档、旧设计记录和测试记录里的旧项目名全部改掉。那些内容是历史记录，盲改反而会降低可追溯性。

## 安全约束

模板初始化只做项目身份替换。以下事情需要人工确认后再做：

- 删除不需要的模块
- 清理历史文档
- 重建数据库
- 移除 Docker 镜像、容器或 volume
- 替换真实第三方凭据

项目身份替换完成后，再根据新项目实际需要清理模块、调整路由入口和更新协作说明。
