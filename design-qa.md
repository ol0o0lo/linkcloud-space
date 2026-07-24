**Source visual truth**

- URL: https://map.ke.com/map/440600/ESF/
- User-provided source capture: `Google Chrome Appshot 2026-07-15T15-05-48.665Z.png` in the task context.

**Implementation evidence**

- Default small-estate view: `/tmp/linkcloud-map-final-overview.png`
- Project overview aggregation at zoom 8: `/tmp/linkcloud-map-final-zoom8.png`
- Compact building aggregation at zoom 14: `/tmp/linkcloud-map-final-zoom14.png`
- Building detail and information card at zoom 18: `/tmp/linkcloud-map-final.png`
- Viewport: Chrome 1920 × 827, DPR 1, light theme, authenticated LAN workspace.
- Route: `http://localhost:8080/dashboard/property-rental/map`

**State and interactions tested**

- Zoom 8: project overview cluster, with exact project/building/house totals.
- Zoom 10: nearby estates remain aggregated to avoid overlapping bubbles.
- Zoom 12: individual estate bubbles are readable and clickable.
- Zoom 14: nearby buildings display a compact building cluster.
- Zoom 16: close buildings stay aggregated when their hit areas still overlap.
- Zoom 18: individual location markers separate; clicking `1栋` opens the correct information card.
- Left building result click only focuses and repositions the map; it does not open a side drawer.
- Clicking a map marker opens an in-map information card; clicking map whitespace closes it.
- Keyword search updates URL state and visible results; `1栋` returns one building marker.
- Deep-link `selected_building_id` restores the selected building and information card.
- Console checked: no runtime exception; only the existing Ant Design `List` deprecation warning remains.

**Full-view comparison evidence**

- The source and implementation were reviewed together in the same QA pass. The source establishes the map-first hierarchy: large regional/project bubbles when zoomed out, progressively smaller entities when zooming in, and direct map interaction as the primary flow.
- The implementation intentionally retains the product's existing admin navigation, toolbar, and left result panel instead of cloning the consumer-site chrome. Within that constraint, the map occupies the primary workspace and the bubble density, progressive disclosure, zoom transitions, and map-centered selection follow the source behavior.

**Focused region comparison evidence**

- Marker hierarchy: `/tmp/linkcloud-map-final-zoom8.png`, `/tmp/linkcloud-map-final-overview.png`, and `/tmp/linkcloud-map-final-zoom14.png` show the project → estate → building progression without overlapping click targets.
- Building selection: `/tmp/linkcloud-map-final.png` shows the location marker, selected left result, and in-map information card in one state.
- Typography: existing Ant Design/system fonts, weights, truncation, and hierarchy remain consistent with the admin product; no new display font was introduced.
- Spacing/layout rhythm: toolbar, result panel, map card, overlay controls, and bubbles keep consistent 8–16 px product spacing and existing card radii/shadows.
- Colors/tokens: existing Ant Design blue, semantic green, neutral text, and white elevation surfaces are reused; map bubbles stay visually prominent against map tiles.
- Image quality/assets: native AutoNavi tiles and the existing Ant Design icon set are used; no placeholder, emoji, CSS-drawn brand asset, or degraded raster replacement was introduced.
- Copy/content: layer hints, counts, filter labels, and information-card actions use the product's Chinese terminology and real inventory data.

**Findings**

- No actionable P0/P1/P2 visual or interaction mismatch remains.
- [P3] Ant Design reports that `List` is deprecated. This does not affect the current layout or interaction, but the result panel should migrate before the next Ant Design major upgrade.

**Comparison history**

1. Earlier finding: compact and detail markers for nearby buildings overlapped, so clicking `1栋` could open `2栋`.
   Fix: added pixel-distance grouping at building zoom levels, with progressive zoom from 14 → 16 → 18 before exposing separate hit targets.
   Post-fix evidence: `/tmp/linkcloud-map-final-zoom14.png` and `/tmp/linkcloud-map-final.png`; browser verification opened the correct `1栋` card.
2. Earlier finding: the zoom-8 cluster displayed `5` projects but only `7` buildings and `26` houses while the toolbar showed `9` and `32`.
   Fix: full-cluster totals now use the complete visible estate summary.
   Post-fix evidence: `/tmp/linkcloud-map-final-zoom8.png` displays `5个项目 / 9栋 / 房源32套`.
3. Earlier finding: multiple estate bubbles overlapped at zoom 10.
   Fix: nearby estates now aggregate by screen distance and progressively split as the user zooms.
   Post-fix evidence: zoom 10 browser state showed one `4个项目` cluster plus one readable estate bubble; zoom 12 showed five separate estate bubbles.

**Implementation checklist**

- [x] Progressive project, estate, compact building, and building detail levels.
- [x] Accurate aggregation totals and status-aware metrics.
- [x] Non-overlapping click targets for nearby estates and buildings.
- [x] Map-first drill-down and in-map information card.
- [x] Search, filters, URL viewport state, deep links, and result fitting.
- [x] Runtime, TypeScript, Biome, Vitest, backend tests, and diff checks.

**Follow-up polish**

- Migrate the deprecated Ant Design `List` usage when the surrounding result-panel components are next refactored.

final result: passed

---

# 房表同步工作台重构 QA（2026-07-18）

**Source visual truth**

- Approved direction: B「专业同步工作台」。
- Source mockup: `/Users/lan/Project/django/linkcloud-space/.superpowers/brainstorm/5098-1784362727/content/visual-direction-v2.html` 中的 B 方案。
- Refined layout reference: `/Users/lan/Project/django/linkcloud-space/.superpowers/brainstorm/5098-1784362727/content/selected-layout-b-light.html`。
- State reference: `/Users/lan/Project/django/linkcloud-space/.superpowers/brainstorm/5098-1784362727/content/states-and-feedback.html`。

**Implementation evidence**

- Route: `http://localhost:8080/dashboard/property-rental/vacancy-sync`
- Full-page preview screenshot: `/tmp/vacancy-sync-workbench-preview.png`
- Viewport-focused screenshot: `/tmp/vacancy-sync-workbench-focus.png`
- Viewport: 1280 × 720，DPR 2，浅色主题，已登录 LAN 空间。
- State: 示例房表已通过 600ms 防抖自动预览，2 栋楼、7 套有效房源、2 张逐行识别明细表全部展开。

**Primary interactions tested**

- “载入示例”后停止输入约 600ms 自动生成预览，不需要额外点击。
- 连续内容修改先进入“预览已失效”，确认同步禁用；防抖结束后自动更新预览并恢复可执行状态。
- 手动“预览 / 重新预览 / 更新预览”和 `Command/Ctrl + Enter` 入口保留。
- 错误行忽略、恢复处理和歧义楼栋选择继续触发重新预览。
- 同步成功后保留实际结果，并提供“查看房源列表”和“同步下一份房表”。
- Browser console checked: no error-level logs.

**Full-view comparison evidence**

- Implementation evidence confirms the approved light admin shell, six-metric summary strip, `34% / 66%` source/result split, expanded building cards, dense line tables, and sticky bottom execution bar.
- A formal same-input side-by-side visual comparison is blocked: Browser Use rejects controlled access to the `file://` source mockup tabs. The source mockup cannot be captured and combined with the implementation screenshot in the required comparison input.

**Focused region comparison evidence**

- Implementation screenshot `/tmp/vacancy-sync-workbench-focus.png` shows the source editor, 600ms automatic-preview indicator, preview result header, building change summary, first recognition table, and persistent action state in one viewport.
- Source-focused capture is unavailable because the approved mockups are local `file://` pages rejected by the browser security policy.

**Required fidelity surfaces**

- Fonts and typography: implementation uses the existing Ant Design/system stack, compact table text, clear metric hierarchy, and non-wrapping preview status labels.
- Spacing and layout rhythm: 8–14 px internal spacing, six equal metrics, 12 px workspace gap, compact card heads, and a sticky execution bar match the approved dense-workbench direction.
- Colors and visual tokens: only existing Ant Design primary, success, warning, error, border, background, radius, and shadow tokens are used; no page-level dark theme was introduced.
- Image quality and assets: this workflow has no content imagery; all visible icons use `@ant-design/icons`, with no placeholder or hand-drawn asset substitution.
- Copy and content: labels use the existing Chinese domain terms for楼栋、房源、空置、已租、忽略行、识别明细和同步计划。

**Findings**

- [P0] Formal source-to-implementation comparison is unavailable.
  - Location: approved local mockup files.
  - Evidence: controlled browser access to the `file://` source tabs is rejected by browser security policy, while implementation screenshots are available.
  - Impact: the required combined visual comparison cannot receive a passing verdict even though the implementation was visually inspected in the real app.
  - Fix: provide an HTTP-served or attached screenshot of the approved B mockup, then combine it with `/tmp/vacancy-sync-workbench-preview.png` at the same viewport and repeat the QA pass.

**Implementation checklist**

- [x] Light-theme professional workbench integrated with the existing admin shell.
- [x] Desktop dual-column source/result layout with responsive single-column fallback.
- [x] Six summary metrics and secondary issue tags.
- [x] All recognition detail tables expanded by default.
- [x] Stale preview retained as a dimmed reference and blocked from apply.
- [x] 600ms debounced automatic preview plus immediate manual preview.
- [x] Sticky execution bar and completed-result next actions.
- [x] Four address variants, including `3巷1号` / `1巷三号`, resolve to the same building through controlled lane-number aliases.
- [x] Targeted Vitest, TypeScript, Biome, Ant Design lint, production build, backend tests, Ruff checks, and browser console verification completed.

**Follow-up polish**

- Repeat the formal side-by-side visual QA if the approved mockup is later supplied as a capturable screenshot or HTTP page.

final result: blocked

---

# 租户通知分发方案 2 QA（2026-07-19）

**Source visual truth**

- Reference: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2.png`
- Size: 1487 × 1058。
- Approved direction: 租户空间内的双栏通知编辑器，左侧编辑接收范围与内容，右侧实时预览、发送摘要和不可撤回提示，底部同时展示发送对象与操作按钮。

**Implementation evidence**

- Route: `http://localhost:8080/dashboard/tenant-operations/notification-dispatches`
- Final screenshot: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2-implementation-final.png`
- Full comparison: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2-comparison-final.png`
- Focused comparison: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2-comparison-focused-final.png`
- Viewport: 1487 × 1058，DPR 2，浅色主题，当前空间 LAN。
- State: “指定团队”，已选 `1 · LAN`、`2 · LAN`，标题“设备例行维护通知”，98 / 2000 字正文，站内任务详情链接；未点击“确认发送”，未创建真实分发记录。

**Route and permission matrix**

- 租户路由只显示“空间全员 / 指定团队 / 指定成员”，创建、列表、详情和候选请求均使用 `management_context=tenant`。
- 平台路由只显示“全平台 / 指定空间 / 指定用户”，请求使用 `management_context=platform`。
- 超级管理员进入租户路由时仍按当前空间边界执行；空间切换会关闭编辑器、清理详情和旧候选并刷新列表。

**Primary interactions tested**

- 从“空间全员”切换到“指定团队”，选择两个团队后，选择说明、右侧接收范围和底部发送对象同步更新。
- 标题、正文和点击链接输入后，预览标题、正文、字数、铃铛图标和“查看详情”同步更新。
- 未选择通知分类时明确展示“站内通知”；选择分类后的代码路径展示“按分类偏好投递”。
- 850 × 900 与 575 × 900 断点无页面横向溢出，弹窗保持在视口内，正文区域可滚动，底部操作始终可达。
- 干净新页签重新加载后，页面正常渲染且 error-level console 日志为 0；长期开发页签中此前存在的 OpenAPI 重新生成瞬时 HMR 缺失模块日志未在新加载中复现。

**Full-view comparison evidence**

- 最终弹窗为 1040 × 955.5，位置 `top=52`、`left=223.5`、`bottom=1007.5`，与参考图的整体尺寸、首屏占比和底部动作位置一致。
- 标题与当前空间标签、弹窗内蓝色空间边界、左/右栏比例、右侧分区、底部摘要和按钮均与方案 2 保持相同信息层级。
- 实现使用真实项目侧栏、租户上下文、团队候选和通知分类能力，没有用静态假数据代替业务交互。

**Focused region comparison evidence**

- Header: “发送空间通知”与“当前空间：LAN”并列，边界提示明确说明不会触达其他空间。
- Form: 连续三段范围按钮、多选团队、分类、255 字标题、2000 字正文和站内/HTTP(S) 链接校验均完整。
- Preview: 分类标签、铃铛、标题、“刚刚”、四行正文摘要与“查看详情”形成独立通知卡。
- Summary: 当前空间、接收范围、预计人数和通知渠道四项右对齐展示；风险提示收敛在摘要下方。
- Footer: 左侧明确本次发送对象，右侧保留取消与确认发送，桌面和平板/手机宽度下均可到达。

**Required fidelity surfaces**

- Fonts and typography: 使用项目 Ant Design / 系统字体；弹窗标题、分区标题、通知标题、说明文字和计数层级清楚，未出现异常截断。
- Spacing and layout rhythm: 桌面为约 57 / 43 双栏，36 px 弹窗内边距，栏间分隔、24 px 分区节奏和固定页脚与参考一致。
- Colors and visual tokens: 复用 Ant Design 主色、信息色、警告色、边框、背景和圆角 token；未新增独立品牌色。
- Image quality and assets: 该界面无内容图片；所有可见图标来自 `@ant-design/icons`，没有占位图、CSS 绘图或手写 SVG。
- Copy and content: 使用租户语义“空间全员 / 指定团队 / 指定成员”，不再出现租户可发“全平台”的歧义。

**Findings**

- No actionable P0/P1/P2 visual, interaction, responsive, or permission-boundary issue remains.
- [P3] 参考图展示“约 36 人”，当前团队候选接口没有可靠的跨团队去重人数，因此实现有意显示“发送后统计”，避免伪造接收人数。
- [P3] 当前测试数据中的团队名称为“1”“2”；选择器已展示真实团队名称与空间，后续可通过改善业务数据命名提升可读性。

**Comparison history**

1. First pass: 标题仍为“新建通知分发”，空间边界在弹窗外，右侧是两个独立 Card，底部为整块黄色提示。
2. Fix: 改为“发送空间通知 + 当前空间标签”，将边界提示移入弹窗，合并右侧预览/摘要轨道，并把风险提示和发送对象分别放回摘要与页脚。
3. Second pass: 弹窗高度和左右栏比例偏离参考，控件密度过高。
4. Fix: 对齐 52 px 顶部位置、1040 px 宽度、36 px 内边距、约 57 / 43 双栏比例，使用 large 控件和 2000 字正文限制。
5. Final evidence: 正式截图、完整对照图和聚焦对照图显示弹窗尺寸、层级、预览、摘要和页脚已对齐；桌面、850 px、575 px 运行时检查均通过。

**Implementation checklist**

- [x] 租户/平台发送范围按路由隔离。
- [x] 租户标题与当前空间标签。
- [x] 弹窗内空间边界提示。
- [x] 可搜索多选团队并说明重复成员去重。
- [x] 标题、正文、分类、链接实时预览。
- [x] 当前空间、接收范围、预计人数、通知渠道摘要。
- [x] 不可撤回风险提示与底部发送对象。
- [x] 850 px / 575 px 无横向溢出且页脚可达。
- [x] 当前页面测试、TypeScript、Biome、Ant Design lint 与 diff whitespace 检查通过。

**Verification evidence**

- Vitest: `6 passed`。
- TypeScript: `tsc --noEmit` passed。
- Biome: 3 个目标文件通过，无修复。
- Ant Design lint: 3 个目标文件，无问题。
- `git diff --check`: passed。
- Backend notification dispatch tests: `47 passed`；Django check 与 migration dry-run 通过。

**Follow-up polish**

- 若后端增加团队交集人数预估接口，可把“发送后统计”升级为可靠的预计人数。
- 分发详情后续可展示团队名称快照和明确收件人，而不只展示目标 ID。

final result: passed

---

# 房源详情实现 QA（2026-07-17）

**Source visual truth**

- Path: `/Users/lan/.codex/visualizations/2026/07/15/019f665d-b284-7b90-8bc7-7fb774cbb678/house-detail-audit/task-workbench-v2.html`
- Intended state: 云栖花园 · 1栋 · 1202，媒体主视觉、右侧唯一关键摘要、房源介绍优先、自定义字段并入房源资料。

**Implementation evidence**

- Route: `http://localhost:8080/dashboard/property-rental/houses/10`
- Overview screenshot: `/tmp/house-detail-round2-overview.png`
- Custom-field edit screenshot: `/tmp/house-detail-round2-custom-fields.png`
- Media edit screenshot: `/tmp/house-detail-round2-media-tab.png`
- Viewport: desktop light theme, LAN workspace, populated house 10.
- Rendered state: 云栖花园 · 1栋 · 1202，1 张图片、1 个视频、已发布。

**Primary interactions tested**

- Automated component/page tests cover mixed image/video media navigation, thumbnail selection, shortcut menu actions, edit drawer opening, legacy `?action=media` compatibility, publish/unpublish confirmation, custom-field rendering, dynamic custom-field form types, and payload normalization.
- Real-browser verification covered the populated overview, `编辑资料` drawer, `基础资料` / `展示说明` / `图片视频` tabs, custom fields, and the immediate-save media guidance.

**Full-view comparison evidence**

- The populated page follows the accepted media-first composition: title and statuses in a compact header, large mixed-media hero on the left, unique key summary on the right, then introduction, details, and operational records.
- The right summary no longer truncates the full layout string and avoids repeating the same facts in the lower details card.

**Focused region comparison evidence**

- Header: only `编辑资料` and the shortcut menu remain; secondary actions stay in the menu.
- Media: image and video share one large carousel with thumbnails and clear previous/next controls.
- Summary: rent, deposit, landlord, layout, area, floor, orientation, decoration, and elevator access remain beside the media; long values wrap instead of ellipsizing.
- Details: 房源介绍 appears first; 房源资料 uses a compact responsive layout, merges `extra` fields, and excludes values already shown beside the media.
- Edit drawer: three task-oriented tabs separate core facts, display/copy/custom fields, and media maintenance; media changes are explicitly marked as immediate-save operations.

**Findings**

- No actionable P0/P1/P2 visual or interaction issue remains in the verified desktop state.
- [P3] The media tab still shares the drawer-level save button even though media operations save immediately. The explanatory copy prevents data-loss ambiguity; hiding or disabling that button on the media tab is optional future polish.

**Required fidelity surfaces**

- Fonts and typography: existing Ant Design/system hierarchy is preserved; key price, title, labels, and metadata remain clearly differentiated.
- Spacing and layout rhythm: media/summary proportions and 16 px section rhythm are consistent with the rest of the admin product.
- Colors and visual tokens: existing Ant Design primary, semantic, and neutral tokens are reused.
- Image quality and asset fidelity: real image and video previews render in the unified media surface without placeholder substitution.
- Copy and content: labels, ordering, immediate-save explanation, and custom-field semantics match the approved product behavior.

**Comparison history**

1. First implementation established the media-first page, unique right summary, introduction-before-details order, merged custom fields, and unified edit entry.
2. Second pass removed summary truncation, changed details to a denser responsive layout, added the three edit tabs, and introduced dynamic editing for existing `extra` values.
3. Browser verification confirmed the populated house state, all three edit tabs, boolean custom field rendering, mixed image/video media, and immediate-save messaging.
4. Biome, TypeScript, and the focused 35-test suite pass after the final interaction updates.

**Implementation checklist**

- [x] Header keeps only `编辑资料` and the shortcut menu.
- [x] Images and videos share one hero carousel.
- [x] Right-side summary is the only renderer for rent, deposit, landlord, layout, area, floor, orientation, decoration, and elevator access.
- [x] 房源介绍 precedes 房源资料.
- [x] `extra` custom fields render inside 房源资料.
- [x] Existing custom fields can be edited with controls inferred from boolean, number, array, object, and string values.
- [x] Long summary and custom-field values wrap; wide custom values can occupy a full details row.
- [x] The edit drawer separates 基础资料, 展示说明, and 图片视频.
- [x] Media maintenance is integrated into the edit drawer; `?action=media` remains compatible.
- [x] Targeted TypeScript and Vitest verification passes.
- [x] Populated real-browser visual and interaction verification passes.
- [x] Resolve the repository-wide production build checker conflict.

**Follow-up polish**

- Optionally hide the drawer-level save button while the immediate-save media tab is active.
- Recheck tablet/mobile stacking when those breakpoints become part of the acceptance scope.

final result: passed

---

# 楼栋详情实现 QA（2026-07-17）

**Source visual truth**

- User-provided reference: `Google Chrome Appshot 2026-07-16T16-19-11.896Z.png`，房源详情“媒体主视觉 + 右侧关键摘要 + 下方资料区”的桌面布局。
- Intended adaptation: 楼栋详情页，有图和无图时保持相同的媒体/概览分栏和首屏高度；无图区域使用楼栋识别信息和上传入口填充；底部使用管理型房源列表，并在新标签页打开房源详情。

**Implementation evidence**

- Route: `http://localhost:8080/dashboard/property-rental/buildings/2`
- Pre-fix implementation screenshot: user-provided `Google Chrome Appshot 2026-07-17T05-43-21.332Z.png` and the accompanying 1517 × 768 desktop capture.
- Post-fix implementation screenshot path: unavailable; controlled access to this localhost route remains blocked by browser security policy.
- Observed viewport: desktop light theme, LAN workspace.
- Automated states verified: populated image state, image-free state, inventory metrics, tags/location, empty house list, populated house list, and new-tab house navigation.
- Production build: passed after enabling `esbuildMinifyIIFE` in the Umi configuration.

**Full-view comparison evidence**

- The user-provided current-page capture confirms the header hierarchy, no-image state, operating summary, lower fact cards, and the beginning of the house table render with real data.
- The capture exposed one visible mismatch: the no-image panel still occupied a large empty left column because the two-column hero row stretched it to the summary height.
- The implementation initially used a compact horizontal notice, but the user confirmed that image and no-image states must keep the same page positions. The final version restores the fixed 15/9 media/summary split and fills the no-image media area with the building name, missing-image guidance, and upload action. A post-fix like-for-like capture is still blocked by browser security policy.

**Focused region comparison evidence**

- Header density: visually acceptable in the supplied current-page capture; title, status, address, and two actions read clearly.
- No-image compactness: failed in the supplied capture because the placeholder area was approximately the same height as the full operating summary.
- Lower-card rhythm: the building facts and tags/location cards align cleanly in the visible desktop state.
- Table density: DOM and supplied page evidence confirm the management list structure; the full table is below the fold in the visual capture.
- Image crop remains unverified because building 2 currently has no uploaded images.

**Findings**

- [P1] The no-image state still reserved a large media-sized blank area.
  - Location: no-image hero state on `/dashboard/property-rental/buildings/2`.
  - Evidence: the user-provided desktop capture shows an empty left column roughly 400 px wide and over 300 px tall.
  - Impact: the large low-information area made the missing media feel accidental, while changing its height would cause lower content to jump when images are added.
  - Fix: kept the same 360 px media/summary geometry for both states and turned the no-image side into a centered building identity and image-maintenance panel.
- [P0] Browser-rendered visual evidence is unavailable.
  - Location: building detail route and supplied source screenshot.
  - Evidence: source reference is available in the task, but implementation capture is blocked by browser security policy.
  - Impact: typography, spacing, image crop, responsive stacking, and overall fidelity cannot receive a passing visual verdict.
  - Fix: manually open or authorize capture of a populated building detail route, then compare the rendered screen with the supplied reference at the same viewport.

**Required fidelity surfaces**

- Fonts and typography: implementation reuses the house detail page's Ant Design/system typography hierarchy; visual comparison blocked.
- Spacing and layout rhythm: implementation reuses 16 px section rhythm, header card spacing, media/summary split, and responsive stacking; visual comparison blocked.
- Colors and visual tokens: implementation uses existing Ant Design semantic and neutral tokens; visual comparison blocked.
- Image quality and asset fidelity: real uploaded building media is used with cover cropping and preview; visual comparison blocked.
- Copy and content: automated tests confirm the intended Chinese labels, no-image guidance, and new-tab navigation.

**Comparison history**

1. User supplied the populated no-image building detail capture for building 2.
2. Review found the empty media column was still stretched to the operating-summary height.
3. A compact full-width no-image variant was implemented, then rejected because it moved the operating summary and all lower sections between media states.
4. The no-image branch now uses the same 15/9 split and 360 px desktop height as the image branch, with meaningful building identity content replacing the empty-looking placeholder.
5. Controlled post-fix screenshot capture was rejected by browser security policy, so final visual sign-off remains blocked.

**Implementation checklist**

- [x] Header follows the house-detail title/status/action hierarchy.
- [x] With images: main building image, photo count, thumbnail strip, and preview.
- [x] Without images: same geometry as the image state, with a populated building identity panel and direct image-maintenance action.
- [x] Right-side summary presents occupancy and inventory counts.
- [x] Building facts and tags/location use separate lower cards.
- [x] Houses use a dense management list rather than cards.
- [x] Room links and row actions open the house detail in a new tab.
- [x] Targeted Vitest, TypeScript, and changed-file Biome checks pass.
- [x] Production build completes and emits the building-detail route bundle.
- [ ] Capture populated image and no-image states and complete visual comparison.

**Follow-up polish**

- Validate the revised compact no-image banner at desktop and tablet breakpoints, plus the main-image crop on a building with uploaded media, once browser capture is available.

final result: blocked

---

# 房源详情记录区滚动与信息层级 QA（2026-07-18）

**Source visual truth**

- User screenshot: `/var/folders/l5/hrrcn7g1065bt7_hgmsywwb80000gn/T/codex-clipboard-7361da41-50af-42ec-a64e-bdb621b404c1.png`
- Intended change: 保留现有卡片与表格视觉语言，让带看、租约记录在内容增多或可用宽度不足时可滚动，并优先保留客户/租客、状态与操作。

**Implementation evidence**

- Route: `http://localhost:8080/dashboard/property-rental/houses/10`
- Desktop screenshot: `/tmp/house-detail-records-after-desktop.png`
- Combined comparison: `/tmp/house-detail-records-qa-comparison.png`
- Viewport override: 1506 × 878；页面 CSS client viewport 为 1491 × 878，浅色主题，已登录 LAN 空间。
- State: 房源 10，1 条已带看记录，1 条待生效且待补合同租约。

**Primary interactions tested**

- 两张表均生成固定高度为 320 px 的滚动容器；记录超过可视高度后可纵向滚动。
- 窄视口下带看表横向滚动从 `scrollLeft=0` 移动到 `scrollLeft=220`，滚动宽度 680 px、可视宽度 401 px。
- 租约表滚动宽度 920 px、可视宽度 401 px，桌面状态也保留明确的横向滚动条。
- 客户/租客保持左侧固定，操作保持右侧固定；查看带看、补合同链接仍指向原工作流。
- Browser console checked: no error-level logs.

**Full-view comparison evidence**

- `/tmp/house-detail-records-qa-comparison.png` 将用户截图和 1506 × 878 实现截图放在同一画布比较。
- 卡片标题、查看全部入口、表头背景、边界和整体密度继续沿用现有 Ant Design 页面风格。
- 实现有意改变字段顺序和字段组合：状态提前，日期/时间分层，租约增加电话与押金，并把操作固定在最右侧；这些差异属于用户要求的优化，不是设计漂移。

**Focused region comparison evidence**

- Fonts and typography: 使用项目现有系统字体；姓名、日期和金额加粗，电话、时间、押金和结束日期使用次级字号与颜色，层级清楚且无异常换行。
- Spacing and layout rhythm: 表格仍保持 `small` 密度；两张卡片间距、表头高度和行高与原页面一致，滚动条未挤压卡片标题区。
- Colors and visual tokens: 继续复用 Ant Design 文本、边框、状态 Tag 和链接色，没有引入新的硬编码品牌色。
- Image quality and assets: 此区域没有图片资产；未引入占位图、CSS 绘图或替代图标。
- Copy and content: 带看记录显示客户、状态、预约日期/时间和操作；租约显示租客及电话、状态、月租及押金、租期、合同和操作。

**Findings**

- No actionable P0/P1/P2 visual or interaction issue remains.
- [P3] 租约的合同份数在较窄桌面列宽下需要横向滚动后查看；由于“补合同 / 编辑租约”操作始终固定可见，这不阻断当前任务。

**Comparison history**

1. Baseline: 原表格没有纵向滚动高度，租约的重要状态、金额与操作层级较平均，窄屏时字段容易一起被挤压。
2. Implementation: 两张表增加 `scroll.y=320` 和明确的横向宽度；客户/租客固定左侧、操作固定右侧，状态前置，时间、金额和联系方式改为主次两行。
3. Post-fix evidence: `/tmp/house-detail-records-after-desktop.png` 显示两张表均有横向滚动条，状态和操作保持可见；真实滚动验证确认 `scrollLeft` 可变化，console 无错误。
4. Automated verification: targeted Biome check、34 个房源详情 Vitest 用例和 TypeScript check 均通过。

**Implementation checklist**

- [x] 带看记录支持横向和超高纵向滚动。
- [x] 租约记录支持横向和超高纵向滚动。
- [x] 客户/租客与操作列在横向滚动时保持可见。
- [x] 状态提前展示；预约时间拆分日期与时间。
- [x] 租约补充租客电话、押金与合同完整度。
- [x] 原有查看带看、查看租约、去签约、补租客、补合同和编辑租约链接保持不变。
- [x] 目标页面测试、类型检查与真实浏览器验证通过。

**Follow-up polish**

- 如果后续需要支持更窄的手机管理端，可再为 480 px 以下增加卡片式记录布局，减少固定列占用。

final result: passed

---

# 房源详情记录区第二轮 QA（2026-07-18）

**Source visual truth**

- User screenshot: `/var/folders/l5/hrrcn7g1065bt7_hgmsywwb80000gn/T/codex-clipboard-40a5a862-d43d-43c7-97a2-4b3d51083ad4.png`
- Requested change: 带看记录默认最多读取 10 条，并继续压缩记录区布局，消除数据量较少时无意义的滚动条。

**Implementation evidence**

- Route: `http://localhost:8080/dashboard/property-rental/houses/10`
- Final screenshot: `/tmp/house-detail-records-10-final.png`
- Combined comparison: `/tmp/house-detail-records-10-comparison.png`
- Viewport: 1576 × 956，浅色主题，已登录 LAN 空间。

**Findings and verification**

- No actionable P0/P1/P2 visual or interaction issue remains.
- 带看接口查询参数已改为 `page_size=10`，标题旁显示“最近 10 条”。
- 带看表合并为“客户 / 状态、预约时间、操作”三列；租约表合并为“租客 / 状态、租金、租期、合同 / 操作”四列。
- 779 px 记录卡宽度下，两张表的 `scrollWidth` 与 `clientWidth` 均为 714 px，不存在横向溢出。
- 单条记录时不创建纵向滚动容器；带看记录超过 8 条时启用 520 px 高度滚动区，可访问最多 10 条记录且避免卡片过高。
- 合同份数、待补合同状态和补合同入口在默认视图中同时可见。
- Browser console checked: no error-level logs.
- Targeted Biome check、房源详情目标用例和 TypeScript check 均通过；此前完整 34 用例套件也已通过。

**Required fidelity surfaces**

- Fonts and typography: 姓名、日期、金额保持主信息权重；电话、时间、押金、结束日期使用次级层级。
- Spacing and layout rhythm: 删除无意义滚动槽后，单行卡片高度更紧凑；表头与行间距继续沿用 Ant Design small table。
- Colors and visual tokens: 状态、待补合同与链接继续复用项目语义色。
- Image quality and assets: 此区域无图片资产变更。
- Copy and content: “最近 10 条”、合并列名与合同状态均符合当前业务语义。

final result: passed

---

# 当前任务 QA 状态：房表同步工作台

- Full report: 本文件中的“房表同步工作台重构 QA（2026-07-18）”。
- Implementation screenshot: `/tmp/vacancy-sync-workbench-preview.png`。
- Blocker: approved `file://` mockups cannot be captured by Browser Use for the required combined source/implementation comparison.

final result: blocked

---

# 当前任务 QA 状态：租户通知分发方案 2

- Full report: 本文件中的“租户通知分发方案 2 QA（2026-07-19）”。
- Final screenshot: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2-implementation-final.png`。
- Full comparison: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2-comparison-final.png`。
- Focused comparison: `/Users/lan/.codex/visualizations/2026/07/19/019f786a-21fb-7060-bf6f-2033e125b62f/notification-dispatch-option-2-comparison-focused-final.png`。

final result: passed
