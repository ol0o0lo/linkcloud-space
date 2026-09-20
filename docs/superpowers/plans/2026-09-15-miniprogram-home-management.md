# 小程序首页设置与功能接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 本仓库当前未授权 Git 操作，因此执行时不创建提交、不暂存文件，也不改写历史。

**Goal:** 在保持小程序首页现有视觉结构、所有身份首页定义一致的前提下，为 Banner、专题活动、租房指南接入 PC 超级管理员设置、有效期、Markdown 正文和专题房源，并补齐首页现有入口的真实跳转。

**Architecture:** 新建独立的 `apps.miniprogram_home` 业务应用，负责首页设置模型、有效期判定、Markdown 安全渲染、超级管理员接口和公开读取接口；PC 管理端只提供“超级管理 > 小程序首页设置”，不建设通用 CMS，也不提供小程序预览。小程序首页只消费公开聚合接口，身份相关管理内容继续留在工作台；专题详情复用公开房源查询规则，已下架房源自动隐藏但关联记录保留。

**Tech Stack:** Django 5、django-ninja、PostgreSQL、Python-Markdown、nh3、pytest、React 19、Umi Max、Ant Design 6、React Query、uni-app、Vue 3、Wot UI v2、TypeScript、原生 `rich-text`。

---

## 已确认范围

### 当前已经可用

- 首页顶部搜索入口、地图找房入口已存在。
- “为你推荐”已经接入公开房源、附近定位、最新、低价、筛选、分页和收藏。
- 公开房源已经统一经过 `get_public_houses_queryset()`，只展示招租中且所属组织有效的房源。
- 首页组件本身没有读取身份模式，所有身份共用同一个首页。

### 本次需要补齐

- Banner、精选专题、租房指南目前是前端硬编码，后台无法维护。
- 专题和指南点击仍显示“筹备中”，没有列表页、详情页和 Markdown 正文。
- “毕业好房”一类专题无法手工选择房源、排序或填写推荐理由。
- Banner、专题和指南没有“指定有效期 / 长期有效”能力。
- 首页快捷入口和热门租住榜目前大多只打开通用找房页，没有携带明确筛选意图。
- 房东、组织身份点击首页公共找房入口时，不能依赖身份化的 Tab 页承接，需要独立的公共找房页。

### 明确不做

- 不建设通用 CMS、栏目树、模板系统、版本系统或发布审批流。
- 不在 PC 后台提供小程序实时预览。
- 不根据用户身份改变首页内容。
- 不把房东、中介、组织管理功能放入首页；这些功能继续放在工作台和现有业务 Tab。
- 不在本期建设数据分析驱动的真实热榜；“热门租住榜”只补齐明确的找房跳转。
- 不在本期接入搬家、保洁、维修、宽带供应商；“安心生活服务”保持现有占位提示。
- 不提供内容物理删除接口；运营撤下内容使用“停用”或结束时间。

## 文件结构

### 后端新增

- `apps/miniprogram_home/__init__.py`：Django 应用包。
- `apps/miniprogram_home/apps.py`：应用配置。
- `apps/miniprogram_home/constants.py`：内容类型、动作类型、色调和展示状态枚举。
- `apps/miniprogram_home/models.py`：Banner、专题/指南、专题房源关联模型。
- `apps/miniprogram_home/services.py`：有效期查询、状态计算、Markdown 渲染、公开聚合和房源同步。
- `apps/miniprogram_home/schemas.py`：管理端与公开端 Ninja schemas。
- `apps/miniprogram_home/api.py`：超级管理员接口和公开接口。
- `apps/miniprogram_home/migrations/0001_initial.py`：业务表结构。
- `apps/miniprogram_home/migrations/0002_seed_current_home.py`：仅迁移当前首页已有文案，保证上线后视觉内容不突然消失。
- `tests/miniprogram_home/test_models.py`：字段约束和有效期状态测试。
- `tests/miniprogram_home/test_services.py`：Markdown、安全过滤、公开房源过滤和关联同步测试。
- `tests/miniprogram_home/test_api.py`：超级管理员权限、管理接口和公开接口测试。

### 后端修改

- `config/settings/_base.py`：注册新应用。
- `config/api.py`：挂载管理端和公开端 routers。
- `pyproject.toml`、`uv.lock`：把 Markdown 解析和 HTML 安全过滤声明为生产依赖。
- `apps/media/constants.py`：增加小程序首页图片资源类型。
- `apps/media/services.py`：允许该资源类型使用用户作用域上传。
- `tests/media/test_api.py`：覆盖首页图片上传作用域。

### PC 管理端新增

- `frontend_admin/src/pages/platform-management/miniprogram-home/service.ts`：页面私有请求适配器。
- `frontend_admin/src/pages/platform-management/miniprogram-home/form.ts`：长期有效、时间范围和表单 payload 的纯函数。
- `frontend_admin/src/pages/platform-management/miniprogram-home/index.tsx`：Banner、专题活动、租房指南三组设置页。
- `frontend_admin/src/pages/platform-management/miniprogram-home/BannerEditorDrawer.tsx`：Banner 新增/编辑抽屉。
- `frontend_admin/src/pages/platform-management/miniprogram-home/EntryEditorDrawer.tsx`：专题/指南新增/编辑抽屉。
- `frontend_admin/src/pages/platform-management/miniprogram-home/HouseSelectionDrawer.tsx`：专题房源选择、排序和推荐理由。
- `frontend_admin/src/pages/platform-management/miniprogram-home/form.test.ts`：表单序列化测试。
- `frontend_admin/src/pages/platform-management/miniprogram-home/index.test.tsx`：页面交互和请求参数测试。

### PC 管理端修改

- `frontend_admin/config/routes.ts`：新增 `/super-admin/miniprogram-home`。
- `frontend_admin/src/routes.test.ts`：确认路由受 `canSuperAdmin` 保护。
- `frontend_admin/src/pages/platform-management/shared.tsx`：增加首页设置查询 key。
- `frontend_admin/src/pages/rental/components/MediaRefsUpload.tsx`：增加可选 `scope`，默认仍为组织作用域。
- `frontend_admin/src/components/AppIcon/index.tsx`：注册首页设置对象及状态图标。
- `frontend_admin/src/components/AppStatus/registry.ts`：注册未启用、待开始、展示中、已结束状态。
- `frontend_admin/src/components/AppStatus/index.test.tsx`：验证状态语义。
- `frontend_admin/docs/design-system.md`：记录新增核心运营状态的语义映射。
- `frontend_admin/src/services/openapi/**`：仅通过生成命令更新，不手改。

### 小程序新增

- `frontend_miniprogram/src/domain/home-content.ts`：首页动作、公开找房查询和内容路由纯函数。
- `frontend_miniprogram/src/services/manual/miniprogram-home.ts`：公开首页请求适配器。
- `frontend_miniprogram/src/features/home/service.ts`：首页 feature service。
- `frontend_miniprogram/src/features/houses/components/PublicHouseSearchView.vue`：从现有找房 Tab 提取的公共找房视图。
- `frontend_miniprogram/src/pages-housing/search/index.vue`：不受当前身份影响的公共找房页。
- `frontend_miniprogram/src/pages-housing/home-content/index.vue`：全部专题/全部指南列表页。
- `frontend_miniprogram/src/pages-housing/home-content/detail.vue`：Markdown 正文和专题房源详情页。
- `frontend_miniprogram/tests/home-content.test.ts`：动作路由、参数解析和响应归一化测试。

### 小程序修改

- `frontend_miniprogram/src/pages/index/index.vue`：加载首页设置并执行真实动作。
- `frontend_miniprogram/src/features/home/components/HomeDiscoverySections.vue`：从 props 渲染 Banner、专题和指南，保留现有布局与样式层级。
- `frontend_miniprogram/src/pages/houses/index.vue`：复用提取后的公共找房视图，身份化工作台分支不变。
- `frontend_miniprogram/src/modules/routes.ts`：增加公共找房、内容列表和详情路由。
- `frontend_miniprogram/tests/module-catalog.test.ts`：继续保证首页与身份无关，并确认新增页属于公共 `housing` 分包。
- `frontend_miniprogram/src/services/openapi/**`：仅通过生成命令更新，不手改。

---

### Task 1: 增加 Markdown 与首页图片生产依赖

**Files:**
- Modify: `pyproject.toml`
- Modify: `uv.lock`
- Modify: `apps/media/constants.py`
- Modify: `apps/media/services.py`
- Test: `tests/media/test_api.py`

- [ ] **Step 1: 写首页图片资源类型失败测试**

在 `tests/media/test_api.py` 增加两个断言：超级管理员使用 `scope=user` 上传 `miniprogram_home_image` 成功；使用 `scope=org` 返回 422。测试只验证媒体平台规则，不要求当前选择组织。

```python
def test_miniprogram_home_image_uses_user_scope(superuser_client, image_file):
    response = superuser_client.post(
        "/api/media/upload/",
        data={"resource_type": "miniprogram_home_image", "scope": "user"},
        files={"files": image_file},
    )
    assert response.status_code == 201


def test_miniprogram_home_image_rejects_org_scope(superuser_client, image_file):
    response = superuser_client.post(
        "/api/media/upload/",
        data={"resource_type": "miniprogram_home_image", "scope": "org"},
        files={"files": image_file},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: 运行媒体定向测试确认红灯**

Run:

```bash
docker compose exec web pytest tests/media/test_api.py -k miniprogram_home_image -q
```

Expected: FAIL，提示资源类型无效。

- [ ] **Step 3: 声明生产依赖和媒体规则**

Run:

```bash
uv add markdown nh3
```

在 `ResourceType` 增加：

```python
MINIPROGRAM_HOME_IMAGE = "miniprogram_home_image", _("小程序首页图片")
```

在 `RESOURCE_TYPE_RULES` 增加：

```python
ResourceType.MINIPROGRAM_HOME_IMAGE: {
    "scopes": {MediaScope.USER},
    "extensions": IMAGE_EXTENSIONS,
},
```

- [ ] **Step 4: 重跑媒体测试**

Expected: 新测试 PASS，既有头像、组织和房源媒体测试不受影响。

---

### Task 2: 建立首页设置领域模型和有效期约束

**Files:**
- Create: `apps/miniprogram_home/__init__.py`
- Create: `apps/miniprogram_home/apps.py`
- Create: `apps/miniprogram_home/constants.py`
- Create: `apps/miniprogram_home/models.py`
- Create: `apps/miniprogram_home/migrations/0001_initial.py`
- Modify: `config/settings/_base.py`
- Test: `tests/miniprogram_home/test_models.py`

- [ ] **Step 1: 写模型失败测试**

覆盖以下行为：

- `starts_at`、`ends_at` 均为空表示长期有效。
- 指定有效期时必须同时填写开始和结束，且结束晚于开始。
- 状态稳定返回 `disabled`、`scheduled`、`active`、`expired`。
- 指南不能关联专题房源。
- 同一专题不能重复关联同一房源。

```python
@pytest.mark.parametrize(
    ("enabled", "starts_delta", "ends_delta", "expected"),
    [
        (False, None, None, "disabled"),
        (True, 1, 2, "scheduled"),
        (True, -1, 1, "active"),
        (True, -2, -1, "expired"),
        (True, None, None, "active"),
    ],
)
def test_display_status(enabled, starts_delta, ends_delta, expected):
    now = timezone.now()
    item = MiniProgramHomeEntry(
        is_enabled=enabled,
        starts_at=now + timedelta(days=starts_delta) if starts_delta is not None else None,
        ends_at=now + timedelta(days=ends_delta) if ends_delta is not None else None,
    )
    assert get_schedule_status(item, now=now) == expected
```

- [ ] **Step 2: 运行模型测试确认红灯**

Run:

```bash
docker compose exec web pytest tests/miniprogram_home/test_models.py -q
```

Expected: FAIL，提示 `apps.miniprogram_home` 不存在。

- [ ] **Step 3: 实现枚举与模型**

固定枚举值：

```python
class HomeEntryKind(StrChoices):
    TOPIC = "topic", "专题活动"
    GUIDE = "guide", "租房指南"


class HomeBannerAction(StrChoices):
    ENTRY = "entry", "专题或指南"
    HOUSE_LIST = "house_list", "条件找房"
    HOUSE_MAP = "house_map", "地图找房"


class HomeDisplayStatus(StrChoices):
    DISABLED = "disabled", "未启用"
    SCHEDULED = "scheduled", "待开始"
    ACTIVE = "active", "展示中"
    EXPIRED = "expired", "已结束"
```

模型字段固定为：

```python
class MiniProgramHomeEntry(CreateUpdateTimeModelMixin):
    kind = models.CharField(max_length=20, choices=HomeEntryKind.choices, db_index=True)
    slug = models.SlugField(max_length=40, unique=True, default=generate_home_entry_slug, editable=False)
    eyebrow = models.CharField(max_length=40, blank=True, default="")
    title = models.CharField(max_length=120)
    summary = models.CharField(max_length=240)
    cover_image = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.MINIPROGRAM_HOME_IMAGE],
    )
    body_markdown = models.TextField(blank=True, default="")
    tone = models.CharField(max_length=20, choices=HomeEntryTone.choices)
    sort_order = models.PositiveIntegerField(default=100, db_index=True)
    is_enabled = models.BooleanField(default=False, db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True, db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")


class MiniProgramHomeBanner(CreateUpdateTimeModelMixin):
    eyebrow = models.CharField(max_length=40, blank=True, default="")
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=240)
    button_text = models.CharField(max_length=20, default="查看详情")
    image = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.MINIPROGRAM_HOME_IMAGE],
    )
    tone = models.CharField(max_length=20, choices=HomeBannerTone.choices)
    action_type = models.CharField(max_length=20, choices=HomeBannerAction.choices)
    entry = models.ForeignKey(MiniProgramHomeEntry, null=True, blank=True, on_delete=models.PROTECT, related_name="banners")
    sort_order = models.PositiveIntegerField(default=100, db_index=True)
    is_enabled = models.BooleanField(default=False, db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True, db_index=True)
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")


class MiniProgramHomeEntryHouse(CreateUpdateTimeModelMixin):
    entry = models.ForeignKey(MiniProgramHomeEntry, on_delete=models.CASCADE, related_name="house_links")
    house = models.ForeignKey("house.House", on_delete=models.CASCADE, related_name="miniprogram_home_entry_links")
    sort_order = models.PositiveIntegerField(default=100)
    recommendation_reason = models.CharField(max_length=120, blank=True, default="")
```

两个可展示模型使用相同数据库约束：时间必须“同时为空”或“同时非空且结束晚于开始”。`MiniProgramHomeEntryHouse` 增加 `(entry, house)` 唯一约束和 `(entry, sort_order, id)` 默认排序。

- [ ] **Step 4: 注册应用并生成迁移**

Run:

```bash
docker compose exec web python manage.py makemigrations miniprogram_home
```

Expected: 生成 `0001_initial.py`，包含三个模型、时间约束和专题房源唯一约束。

- [ ] **Step 5: 重跑模型测试**

Expected: PASS。

---

### Task 3: 实现有效内容查询、Markdown 安全渲染与房源同步

**Files:**
- Create: `apps/miniprogram_home/services.py`
- Test: `tests/miniprogram_home/test_services.py`

- [ ] **Step 1: 写服务失败测试**

测试以下边界：

- 当前时间恰好等于 `starts_at` 时可展示，等于 `ends_at` 时不可展示。
- Markdown 的标题、列表、粗体正常保留。
- `<script>`、事件属性和 `javascript:` 链接被移除。
- 新加入专题的房源必须来自 `get_public_houses_queryset()`。
- 已经加入专题后下架的房源仍保留管理关联，可继续调整顺序和理由。
- 公开专题房源自动隐藏已下架房源和无效组织房源。
- 把已有房源的专题改成指南时返回明确校验错误。

- [ ] **Step 2: 运行服务测试确认红灯**

Run:

```bash
docker compose exec web pytest tests/miniprogram_home/test_services.py -q
```

Expected: FAIL，提示服务函数不存在。

- [ ] **Step 3: 实现统一时间状态和公开查询**

```python
def active_at(queryset, *, now=None):
    now = now or timezone.now()
    return queryset.filter(is_enabled=True).filter(
        Q(starts_at__isnull=True, ends_at__isnull=True)
        | Q(starts_at__lte=now, ends_at__gt=now)
    )


def get_schedule_status(item, *, now=None):
    now = now or timezone.now()
    if not item.is_enabled:
        return HomeDisplayStatus.DISABLED
    if item.starts_at is None and item.ends_at is None:
        return HomeDisplayStatus.ACTIVE
    if now < item.starts_at:
        return HomeDisplayStatus.SCHEDULED
    if now >= item.ends_at:
        return HomeDisplayStatus.EXPIRED
    return HomeDisplayStatus.ACTIVE
```

公开聚合固定上限：Banner 前 5 条、专题前 2 条、指南前 2 条；排序统一为 `sort_order, id`。动作类型为 `entry` 的 Banner 仅在关联内容本身也处于展示中时返回，避免死链接。

- [ ] **Step 4: 实现 Markdown 转换与白名单过滤**

```python
ALLOWED_MARKDOWN_TAGS = {
    "p", "br", "h1", "h2", "h3", "h4", "ul", "ol", "li",
    "blockquote", "strong", "em", "code", "pre", "a", "hr",
}


def render_home_markdown(source: str) -> str:
    rendered = markdown.markdown(source or "", extensions=["sane_lists"])
    return nh3.clean(
        rendered,
        tags=ALLOWED_MARKDOWN_TAGS,
        attributes={"a": {"href", "title"}},
        url_schemes={"http", "https"},
        link_rel="noopener noreferrer",
    )
```

本期正文图片只使用内容封面，不开放 Markdown 内联图片标签，避免对象存储域名、尺寸和微信下载域名形成第二套上传流程。

- [ ] **Step 5: 实现专题房源原子同步**

`sync_entry_houses(entry, items)` 在事务内完成：

1. 拒绝指南类型。
2. 拒绝重复 `house_id`。
3. 读取当前已有房源 ID。
4. 只有新增 ID 必须命中 `get_public_houses_queryset()`；已存在但后来下架的 ID允许保留和更新。
5. 更新已有关系、创建新增关系、移除本次 payload 不再包含的关系。
6. `sort_order` 由 payload 顺序重新写为 `10, 20, 30...`，不信任客户端自造重复排序值。

- [ ] **Step 6: 重跑服务测试**

Expected: PASS。

---

### Task 4: 提供超级管理员设置接口

**Files:**
- Create: `apps/miniprogram_home/schemas.py`
- Create: `apps/miniprogram_home/api.py`
- Modify: `config/api.py`
- Test: `tests/miniprogram_home/test_api.py`

- [ ] **Step 1: 写管理接口失败测试**

至少覆盖：

- 未登录返回 401/403，普通用户和 staff 返回 403，超级管理员成功。
- Banner 和内容支持分页列表、创建、详情、PATCH 和启停，不提供 DELETE。
- 长期有效 payload 把两个时间都保存为 `null`。
- 只填写一个时间、结束早于开始、`entry` 动作没有关联内容均返回 422。
- 关联内容动作可以选择专题或指南；公开层会根据关联内容状态决定 Banner 是否展示。
- 专题房源候选接口只返回公开房源。
- 专题房源同步保存顺序和推荐理由。

- [ ] **Step 2: 运行 API 测试确认红灯**

Run:

```bash
docker compose exec web pytest tests/miniprogram_home/test_api.py -q
```

Expected: FAIL，提示 router 或 schema 不存在。

- [ ] **Step 3: 定义稳定的管理端 schema**

管理端输出需要包含：

```python
class MiniProgramHomeEntryAdminOut(Schema):
    id: int
    kind: str
    kind__mapping: str
    slug: str
    eyebrow: str
    title: str
    summary: str
    cover_image: list[ResolvedMediaRefOut]
    body_markdown: str
    tone: str
    sort_order: int
    is_enabled: bool
    starts_at: datetime | None
    ends_at: datetime | None
    display_status: str
    display_status__mapping: str
    house_count: int
    created_at: datetime
    updated_at: datetime
```

Banner 管理输出增加 `action_type`、`action_type__mapping`、`entry_id`、`entry_title` 和 `image`；专题房源输入固定为：

```python
class MiniProgramHomeEntryHouseItemIn(Schema):
    house_id: int
    recommendation_reason: str = Field("", max_length=120)


class MiniProgramHomeEntryHousesPutIn(Schema):
    items: list[MiniProgramHomeEntryHouseItemIn]
```

- [ ] **Step 4: 实现管理路由**

所有 handler 第一行调用 `require_superuser(request)`：

```text
GET    /api/admin/miniprogram-home/banners/
POST   /api/admin/miniprogram-home/banners/
GET    /api/admin/miniprogram-home/banners/{banner_id}/
PATCH  /api/admin/miniprogram-home/banners/{banner_id}/
GET    /api/admin/miniprogram-home/entries/
POST   /api/admin/miniprogram-home/entries/
GET    /api/admin/miniprogram-home/entries/{entry_id}/
PATCH  /api/admin/miniprogram-home/entries/{entry_id}/
GET    /api/admin/miniprogram-home/house-candidates/
GET    /api/admin/miniprogram-home/entries/{entry_id}/houses/
PUT    /api/admin/miniprogram-home/entries/{entry_id}/houses/
```

所有列表使用 `response=list[...]`、`@paginate(LegacyPagination)` 和 `page/page_size`。创建和更新统一写入 `created_by`、`updated_by`，并把 Django `ValidationError` 转换为 422 字段错误。

- [ ] **Step 5: 挂载 router 并重跑测试**

在 `config/api.py` 挂载：

```python
api.add_router("/admin/miniprogram-home/", miniprogram_home_admin_router)
```

Expected: 管理接口测试 PASS。

---

### Task 5: 提供小程序公开聚合、内容列表、详情和专题房源接口

**Files:**
- Modify: `apps/miniprogram_home/schemas.py`
- Modify: `apps/miniprogram_home/api.py`
- Modify: `config/api.py`
- Test: `tests/miniprogram_home/test_api.py`

- [ ] **Step 1: 写公开接口失败测试**

覆盖：

- 所有公开接口 `auth=None`，游客可访问。
- 首页聚合只返回展示中的数据并遵守 5/2/2 上限和排序。
- 成功但没有配置时返回空数组，不回退到前端假数据。
- 内容列表按 `kind` 分页。
- 未启用、待开始和已结束内容详情返回 404。
- 公开详情只返回安全 HTML，不返回原始 Markdown。
- 专题房源分页遵循 `{items,total,page,page_size}`。
- 专题房源自动隐藏下架房源，但管理接口仍看得到关联。
- 指南房源接口返回 404，避免误把指南当专题。

- [ ] **Step 2: 实现公开 schema**

```python
class MiniProgramHomeEntrySummaryOut(Schema):
    slug: str
    kind: str
    eyebrow: str
    title: str
    summary: str
    cover_image: list[ResolvedMediaRefOut]
    tone: str


class MiniProgramHomeEntryDetailOut(MiniProgramHomeEntrySummaryOut):
    body_html: str


class MiniProgramHomeBannerPublicOut(Schema):
    id: int
    eyebrow: str
    title: str
    description: str
    button_text: str
    image: list[ResolvedMediaRefOut]
    tone: str
    action_type: str
    entry_slug: str | None


class MiniProgramHomeOut(Schema):
    banners: list[MiniProgramHomeBannerPublicOut]
    topics: list[MiniProgramHomeEntrySummaryOut]
    guides: list[MiniProgramHomeEntrySummaryOut]
```

专题房源输出使用 `{ house: PublicHouseListOut, recommendation_reason: str }`，不复制第二套房源展示字段。

- [ ] **Step 3: 实现公开路由并挂载**

```text
GET /api/public/miniprogram/home/
GET /api/public/miniprogram/home-entries/?kind=topic&page=1&page_size=20
GET /api/public/miniprogram/home-entries/{slug}/
GET /api/public/miniprogram/home-entries/{slug}/houses/?page=1&page_size=10
```

在 `config/api.py` 挂载：

```python
api.add_router("/public/miniprogram/", miniprogram_home_public_router)
```

- [ ] **Step 4: 重跑公开接口测试**

Expected: PASS。

---

### Task 6: 迁移当前首页文案，保持首次上线外观

**Files:**
- Create: `apps/miniprogram_home/migrations/0002_seed_current_home.py`
- Test: `tests/miniprogram_home/test_models.py`

- [ ] **Step 1: 写种子数据迁移测试**

使用 `MigrationExecutor` 断言迁移后存在：3 条 Banner、3 条专题、2 条指南；首页聚合仍只取前 2 条专题。所有记录默认启用、长期有效、无图片，不创建任何房源关联。

- [ ] **Step 2: 实现不可逆删除的安全数据迁移**

只迁移当前前端已经出现的文案：

- Banner：通勤 30 分钟、毕业季安心租、地图找房。
- 首页专题：地铁沿线好房、月租 3000 内。
- Banner 关联专题：毕业季安心租。
- 指南：第一次租房必须确认的 8 件事、通勤时间怎么估算。

正文只用现有标题和摘要组成最小 Markdown，不新增未经确认的运营文案：

```python
body_markdown = f"# {title}\n\n{summary}"
```

反向迁移使用 `migrations.RunPython.noop`，不在回滚时物理删除运营数据。

- [ ] **Step 3: 运行迁移测试**

Run:

```bash
docker compose exec web pytest tests/miniprogram_home/test_models.py -k migration -q
```

Expected: PASS。

---

### Task 7: 生成两端 OpenAPI 类型

**Files:**
- Regenerate: `frontend_admin/src/services/openapi/**`
- Regenerate: `frontend_miniprogram/src/services/openapi/**`

- [ ] **Step 1: 启动包含新接口的后端并检查 schema**

Run:

```bash
curl -fsS http://localhost:18000/api/openapi.json | rg "miniprogram/home"
```

Expected: 同时看到 `/api/admin/miniprogram-home/` 和 `/api/public/miniprogram/` 路由。

- [ ] **Step 2: 生成 PC 管理端客户端**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
npm --prefix frontend_admin run openapi
```

Expected: `API.MiniProgramHome*` 类型生成成功，无手工编辑生成文件。

- [ ] **Step 3: 生成小程序客户端**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
pnpm --dir frontend_miniprogram openapi
```

Expected: 首页公开响应、内容详情和专题房源类型出现在生成类型中。

---

### Task 8: 改造 PC 媒体上传组件和首页设置请求层

**Files:**
- Modify: `frontend_admin/src/pages/rental/components/MediaRefsUpload.tsx`
- Create: `frontend_admin/src/pages/platform-management/miniprogram-home/service.ts`
- Create: `frontend_admin/src/pages/platform-management/miniprogram-home/form.ts`
- Test: `frontend_admin/src/pages/platform-management/miniprogram-home/form.test.ts`

- [ ] **Step 1: 写表单与上传 scope 失败测试**

测试：长期有效输出 `starts_at: null, ends_at: null`；指定有效期输出 ISO 字符串；Banner `entry` 动作保留 `entry_id`，切换到找房或地图动作时清空 `entry_id`；媒体上传使用调用方传入的 `scope=user`。

- [ ] **Step 2: 实现 `MediaRefsUpload` 的兼容改造**

Props 增加：

```ts
scope?: 'user' | 'org';
```

默认值保持：

```ts
scope = 'org'
```

上传请求改为：

```ts
appsMediaApiUploadFiles(
  { resource_type: resourceType, scope },
  files,
)
```

这样既有房源、小区和楼栋上传行为不变，首页设置显式传 `scope="user"`。

- [ ] **Step 3: 实现页面私有 service**

使用 `@umijs/max` 的 `request` 和生成的 `API.MiniProgramHome*` 类型，固定 base path：

```ts
const BASE_PATH = '/api/admin/miniprogram-home';
```

完整封装 Task 4 的所有接口；分页统一返回：

```ts
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
```

- [ ] **Step 4: 实现表单序列化纯函数**

```ts
export function schedulePayload(longTerm: boolean, range?: [Dayjs, Dayjs]) {
  if (longTerm) return { starts_at: null, ends_at: null };
  if (!range) throw new Error('请选择有效期');
  return {
    starts_at: range[0].toISOString(),
    ends_at: range[1].toISOString(),
  };
}
```

- [ ] **Step 5: 运行管理端定向测试**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
npm --prefix frontend_admin exec -- vitest run src/pages/platform-management/miniprogram-home/form.test.ts
```

Expected: PASS。

---

### Task 9: 注册 PC 超管路由和运营状态

**Files:**
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/routes.test.ts`
- Modify: `frontend_admin/src/components/AppIcon/index.tsx`
- Modify: `frontend_admin/src/components/AppStatus/registry.ts`
- Modify: `frontend_admin/src/components/AppStatus/index.test.tsx`
- Modify: `frontend_admin/docs/design-system.md`

- [ ] **Step 1: 写路由和状态失败测试**

断言 `/super-admin/miniprogram-home` 位于 `canSuperAdmin` 路由组内；状态语义固定为：

```text
disabled  -> disabled
scheduled -> warning
active    -> success
expired   -> secondary
```

- [ ] **Step 2: 添加超级管理菜单项**

在 referrals 后增加：

```ts
{
  name: '小程序首页设置',
  locale: false,
  icon: 'picture',
  path: '/super-admin/miniprogram-home',
  component: './platform-management/miniprogram-home',
},
```

使用 `locale: false`，本次不修改任何多语言菜单文件。

- [ ] **Step 3: 注册状态图标和 `AppStatus`**

对象名统一使用 `miniprogram-home.item`，状态名直接复用后端值。表格使用：

```tsx
<AppStatusTag name="miniprogram-home.item" state={record.display_status}>
  {record.display_status__mapping}
</AppStatusTag>
```

同时在设计系统核心状态表记录这四个状态，确保图标、文字和语义色一致。

- [ ] **Step 4: 运行路由和状态测试**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
npm --prefix frontend_admin exec -- vitest run src/routes.test.ts src/components/AppStatus/index.test.tsx
```

Expected: PASS。

---

### Task 10: 实现 PC 小程序首页设置页面

**Files:**
- Create: `frontend_admin/src/pages/platform-management/miniprogram-home/index.tsx`
- Create: `frontend_admin/src/pages/platform-management/miniprogram-home/BannerEditorDrawer.tsx`
- Create: `frontend_admin/src/pages/platform-management/miniprogram-home/EntryEditorDrawer.tsx`
- Create: `frontend_admin/src/pages/platform-management/miniprogram-home/HouseSelectionDrawer.tsx`
- Modify: `frontend_admin/src/pages/platform-management/shared.tsx`
- Test: `frontend_admin/src/pages/platform-management/miniprogram-home/index.test.tsx`

- [ ] **Step 1: 写页面失败测试**

使用 Testing Library 和 mock service 覆盖：

- 页面显示“Banner / 专题活动 / 租房指南”三个 Tab。
- 新增 Banner 时可选择“专题或指南 / 条件找房 / 地图找房”。
- 动作为专题或指南时必须选择关联内容。
- 新增专题时可保存封面、Markdown、长期有效和启用状态。
- 指南不显示“管理房源”。
- 专题“管理房源”可以搜索候选房源、加入、移除、上下排序、填写推荐理由并一次保存。
- 加载、保存和列表错误都有可重试反馈。
- 不出现预览按钮和删除按钮。

- [ ] **Step 2: 实现页面骨架和列表**

使用 `PageContainer`、`Tabs`、`ProTable`、`AppStatusTag`。每个 Tab 只有一个主按钮：

- Banner：新增 Banner。
- 专题活动：新增专题。
- 租房指南：新增指南。

列表列固定为封面、标题、动作/类型、状态、有效期、排序、更新时间、操作。首页展示顺序以 `sort_order, id` 为准，并在文案中说明“Banner 最多展示前 5 条，专题和指南各展示前 2 条”。

- [ ] **Step 3: 实现 Banner 编辑抽屉**

字段：眉标题、标题、说明、按钮文字、配图、色调、动作类型、关联内容、排序、长期有效、有效期、启用。色调仅允许现有 `blue / violet / teal`，不开放任意颜色。

- [ ] **Step 4: 实现专题/指南编辑抽屉**

字段：类型、眉标题、标题、摘要、封面、色调、Markdown 正文、排序、长期有效、有效期、启用。正文使用普通 `Input.TextArea`，不增加富文本编辑器和预览器。专题色调只提供 `sage / lavender`，指南只提供 `slate / clay`。

- [ ] **Step 5: 实现专题房源抽屉**

候选区使用分页表格和关键词搜索；已选区显示房源标题、当前房源状态、推荐理由、上移、下移、移除。下架后保留的关联显示状态警告，但仍允许调整理由和排序。保存时调用一次 PUT，避免多次请求产生中间状态。

- [ ] **Step 6: 运行页面测试、类型检查和 Ant Design 检查**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
npm --prefix frontend_admin exec -- vitest run src/pages/platform-management/miniprogram-home/index.test.tsx
npm --prefix frontend_admin run tsc
npm --prefix frontend_admin exec -- antd lint ./src/pages/platform-management/miniprogram-home
```

Expected: 全部 PASS，且没有新增依赖、锁文件或多语言文件变更。

---

### Task 11: 建立小程序首页请求层和动作路由

**Files:**
- Create: `frontend_miniprogram/src/domain/home-content.ts`
- Create: `frontend_miniprogram/src/services/manual/miniprogram-home.ts`
- Create: `frontend_miniprogram/src/features/home/service.ts`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Test: `frontend_miniprogram/tests/home-content.test.ts`
- Test: `frontend_miniprogram/tests/module-catalog.test.ts`

- [ ] **Step 1: 写路由和查询失败测试**

覆盖：

- 专题详情 slug 和内容类型参数被安全编码。
- 快捷入口映射：地铁找房 `tags=近地铁`、低价好房 `sort=rent_asc`、品质整租 `tags=整租`、最新上架 `sort=latest`。
- 热门租住榜映射：热门区域打开筛选面板、地铁线路带 `tags=近地铁`、性价比榜 `sort=rent_asc`。
- Banner `entry` 打开内容详情，`house_list` 打开公共找房页，`house_map` 打开地图页。
- 未知 action 不导航并返回可展示错误。

- [ ] **Step 2: 注册公共分包路由**

在 `APP_ROUTES` 增加：

```ts
publicHouseSearch: buildSubpackageRoute('housing', 'search/index'),
homeContentList: buildSubpackageRoute('housing', 'home-content/index'),
homeContentDetail: buildSubpackageRoute('housing', 'home-content/detail'),
```

提供 `getPublicHouseSearchRoute()`、`getHomeContentListRoute()`、`getHomeEntryRoute()` 三个构造器。

- [ ] **Step 3: 实现公开请求适配器**

所有请求使用：

```ts
const publicRequestOptions = { requestScope: { kind: 'public' as const } }
```

封装 Task 5 的四个接口，页面不得直接导入 generated client。

- [ ] **Step 4: 运行小程序领域测试**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
pnpm --dir frontend_miniprogram test tests/home-content.test.ts tests/module-catalog.test.ts
```

Expected: PASS。

---

### Task 12: 提取公共找房视图，保证所有身份都能承接首页入口

**Files:**
- Create: `frontend_miniprogram/src/features/houses/components/PublicHouseSearchView.vue`
- Create: `frontend_miniprogram/src/pages-housing/search/index.vue`
- Modify: `frontend_miniprogram/src/pages/houses/index.vue`
- Modify: `frontend_miniprogram/src/domain/home-content.ts`
- Test: `frontend_miniprogram/tests/home-content.test.ts`
- Test: `frontend_miniprogram/tests/module-catalog.test.ts`

- [ ] **Step 1: 写公共找房承接失败测试**

断言新页面存在且位于 `housing` 公共分包；支持解析 `keyword`、`tags`、`sort`、`min_rent`、`max_rent` 和 `open_filters=1`；首页源码不读取 `navigationMode/currentMode`。

- [ ] **Step 2: 从找房 Tab 提取公共视图**

把 `frontend_miniprogram/src/pages/houses/index.vue` 中 visitor/personal 的搜索、筛选、排序、公开房源列表和分页逻辑移入 `PublicHouseSearchView.vue`。组件接收：

```ts
interface Props {
  initialQuery?: PublicHouseSearchQuery
  embedded?: boolean
}
```

`embedded=true` 用于 Tab 页，`embedded=false` 用于公共分包页；房源展示继续复用 `HouseCard` 和共享户型格式化逻辑。

- [ ] **Step 3: 保持身份化工作台分支不变**

原找房 Tab 中：visitor/personal 渲染共享公共视图；landlord/organization 的现有房源和工作台内容不移动、不改业务。首页的公共入口统一 `navigateTo(APP_ROUTES.publicHouseSearch)`，因此不再误入身份化 Tab。

- [ ] **Step 4: 支持路由初始筛选**

公共页 `onLoad` 解析白名单参数；未知 sort、非数字租金和空 tag 被忽略。`open_filters=1` 首次加载后直接打开筛选面板。清除筛选时同时清除路由传入的 tags。

- [ ] **Step 5: 运行测试和类型检查**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
pnpm --dir frontend_miniprogram test tests/home-content.test.ts tests/module-catalog.test.ts tests/house.test.ts
pnpm --dir frontend_miniprogram type-check
```

Expected: PASS。

---

### Task 13: 将首页静态内容替换为公开设置数据

**Files:**
- Modify: `frontend_miniprogram/src/pages/index/index.vue`
- Modify: `frontend_miniprogram/src/features/home/components/HomeDiscoverySections.vue`
- Test: `frontend_miniprogram/tests/home-content.test.ts`
- Test: `frontend_miniprogram/tests/module-catalog.test.ts`

- [ ] **Step 1: 写首页数据接入失败测试**

断言首页调用 `getMiniProgramHome()`；`HomeDiscoverySections` 不再声明 `heroBanners/topics/guides` 硬编码数组；专题、指南和 Banner 动作通过 slug/action_type 分发；接口成功返回空数组时不恢复假内容；接口失败保留页面其他找房功能并提供轻量重试入口。

- [ ] **Step 2: 加载首页聚合数据**

首页增加 `homeContent/loading/error` 状态，在首次进入和下拉刷新时加载。接口失败不能阻断推荐房源；Banner/专题/指南区域显示与现有卡片同尺寸的失败状态和“重新加载”，搜索、快捷入口、地图、推荐流继续可用。

- [ ] **Step 3: 改造 `HomeDiscoverySections` 数据契约**

Props：

```ts
interface Props {
  content: MiniProgramHomeOut | null
  loading: boolean
  error: boolean
}
```

Emits：

```ts
find: [query?: PublicHouseSearchQuery]
map: []
openEntry: [slug: string]
openList: [kind: 'topic' | 'guide']
retry: []
reserved: [title: string]
```

保留现有 hero、topic、guide DOM 层级和尺寸；可选配图只作为卡片背景层并加现有色调遮罩，不改变文字层级、卡片高度和间距。

- [ ] **Step 4: 补齐固定入口动作**

- 顶部搜索和“条件找房”打开独立公共找房页。
- 快捷找房和热门租住榜携带 Task 11 定义的白名单筛选。
- “全部专题 / 全部内容”进入内容列表页。
- “更多榜单”进入公共找房页。
- 安心生活服务继续使用现有“筹备中”提示。

- [ ] **Step 5: 重跑首页边界测试**

Expected: 首页仍不读取身份模式，所有身份看到相同内容和相同公共找房入口。

---

### Task 14: 实现专题/指南列表、Markdown 详情和专题房源

**Files:**
- Create: `frontend_miniprogram/src/pages-housing/home-content/index.vue`
- Create: `frontend_miniprogram/src/pages-housing/home-content/detail.vue`
- Modify: `frontend_miniprogram/src/features/home/service.ts`
- Test: `frontend_miniprogram/tests/home-content.test.ts`

- [ ] **Step 1: 写页面边界失败测试**

断言列表只接受 `topic/guide`；详情 slug 为空时进入错误态；正文使用原生 `rich-text`；专题加载房源，指南不请求房源；专题房源卡点击进入现有房源详情；推荐理由为空时不显示空容器。

- [ ] **Step 2: 实现全部专题/指南列表**

使用 `usePagedPage` 调用公开内容列表，页面标题根据 kind 显示“精选专题”或“租房指南”。卡片继续使用首页相同色调和封面处理，覆盖加载、空、错误、重试和触底分页。

- [ ] **Step 3: 实现内容详情**

详情顶部展示眉标题、标题、摘要和封面；正文使用：

```vue
<rich-text class="home-content-body" :nodes="entry.body_html" />
```

正文样式只处理段落、标题、列表、引用、链接和代码的间距与换行，不在小程序端再次解析或信任原始 Markdown。

- [ ] **Step 4: 实现专题房源列表**

只有 `kind=topic` 请求 `/houses/`；使用 `AppPagedList`、`HouseCard` 和现有收藏能力。每张房源卡上方可显示 `recommendation_reason`，房源数据仍使用 `PublicHouseListOut`，确保“单间”规则和其他公开房源展示规则一致。

- [ ] **Step 5: 运行小程序定向验证**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
pnpm --dir frontend_miniprogram test tests/home-content.test.ts tests/house.test.ts tests/module-catalog.test.ts
pnpm --dir frontend_miniprogram lint
pnpm --dir frontend_miniprogram type-check
```

Expected: PASS，且 `package.json`、`pnpm-lock.yaml` 和多语言文件没有变更。

---

### Task 15: 全链路验证

**Files:**
- Verify only

- [ ] **Step 1: 后端定向测试**

Run:

```bash
docker compose exec web pytest tests/miniprogram_home tests/media/test_api.py -q
```

Expected: PASS。

- [ ] **Step 2: 后端迁移和静态检查**

Run:

```bash
docker compose exec web python manage.py makemigrations --check
docker compose exec web ruff check apps/miniprogram_home tests/miniprogram_home apps/media/constants.py apps/media/services.py tests/media/test_api.py
```

Expected: 没有缺失迁移，Ruff PASS。

- [ ] **Step 3: PC 管理端验证**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
npm --prefix frontend_admin exec -- vitest run src/pages/platform-management/miniprogram-home src/routes.test.ts src/components/AppStatus/index.test.tsx
npm --prefix frontend_admin run lint
```

Expected: PASS。

- [ ] **Step 4: 小程序验证**

Run:

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
pnpm --dir frontend_miniprogram test tests/home-content.test.ts tests/house.test.ts tests/module-catalog.test.ts
pnpm --dir frontend_miniprogram lint
pnpm --dir frontend_miniprogram type-check
pnpm --dir frontend_miniprogram build:h5:prod
pnpm --dir frontend_miniprogram build:mp:prod
```

Expected: H5 和微信小程序构建均成功。

- [ ] **Step 5: 人工功能验收**

按以下顺序验收，不要求 PC 后台提供小程序预览：

1. 超级管理员新增一个长期有效专题，上传封面、填写 Markdown、选择两套公开房源并调整顺序。
2. 新增关联该专题的 Banner 并启用，确认小程序首页出现且点击进入详情。
3. 将其中一套房源下架，确认专题详情自动隐藏该房源，后台关联仍存在并标记当前状态。
4. 新增未来开始的活动，确认后台显示“待开始”、小程序不展示；把时间改到当前范围后开始展示。
5. 新增长期有效指南，确认首页摘要、全部指南列表、Markdown 详情完整。
6. 分别以游客、个人、房东、组织身份打开首页，确认首页结构和运营内容完全一致。
7. 从房东、组织身份点击顶部搜索、快捷找房和 Banner 条件找房，确认进入公共找房页而不是管理工作台。
8. 检查脚本、事件属性和 `javascript:` Markdown 链接没有进入小程序返回 HTML。

---

## 计划自查结果

- **需求覆盖：** Banner、专题、指南、配图、文字、Markdown、专题选房、推荐理由、排序、指定有效期、长期有效、超级管理员权限、首页身份一致、下架房源隐藏均有明确任务。
- **闭环补足：** “全部专题/指南”和房东/组织身份的公共找房承接已纳入，否则首页仍会存在不可用入口。
- **边界控制：** 没有加入通用 CMS、后台预览、内容删除、生活服务供应商、真实热榜分析或身份化首页。
- **依赖控制：** 小程序不新增 Markdown 依赖；PC 管理端不新增编辑器依赖；只在后端增加必要的 Markdown 和 HTML 安全过滤依赖。
- **生成代码：** 两端 OpenAPI 文件只通过生成命令更新，不手改。
- **仓库约束：** 计划不包含 Git 操作、不包含物理删除命令，也不要求修改前端包文件或多语言文件。
