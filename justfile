import 'config/base.just'

project_slug := 'linkcloud-space'

# List available commands
@_default:
    just -l

# Create or regenerate .env file from pyproject.toml schema
@create_env:
    uvx epicenv create

# Start SaaS admin frontend dev server
@admin_dev:
    cd frontend_admin && pnpm dev

# Build SaaS admin frontend assets
@admin_build:
    just build_admin

# Start mini program frontend dev server for WeChat
@miniprogram_dev:
    cd frontend_miniprogram && pnpm dev:mp-weixin

# Build mini program frontend assets for WeChat
@miniprogram_build:
    cd frontend_miniprogram && pnpm build:mp-weixin

# Build mini program H5 assets and collect them into Django static files
@miniprogram_build_h5:
    just build_h5

# Remove extra Django Base Site files not needed in a new project
@clean_extra_files:
    rm -f LICENSE.md
    rm -f README.md
    rm -f CHANGELOG.md
    rm -rf docs/
    rm -rf .github/
    rm -rf .readthedocs.yaml
    rm -r scripts/start_new_project

# Upgrade both Python and Node
@upgrade_all_packages:
    # kill all running containers
    docker stop $(docker ps -a -q) || true
    # remove all stopped containers
    docker rm $(docker ps -a -q) || true
    just upgrade_python_packages
    just upgrade_node_packages
    just build
    just pre_commit
