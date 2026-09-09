import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as routes from '../src/modules/routes.ts'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(testsDirectory, '../src')
const domainPath = join(sourceRoot, 'domain/organization-work.ts')

test('组织协作领域规则严格沿用后端状态与组织请求作用域', async () => {
  assert.equal(existsSync(domainPath), true, 'domain/organization-work.ts 应存在')
  const domain = await import('../src/domain/organization-work.ts')

  assert.deepEqual(domain.buildOrganizationWorkScope(' alpha '), {
    requestScope: { kind: 'organization', organizationSlug: 'alpha' },
    authRetry: 'safe',
  })
  assert.deepEqual(domain.buildOrganizationWorkScope('alpha', 'never'), {
    requestScope: { kind: 'organization', organizationSlug: 'alpha' },
    authRetry: 'never',
  })
  assert.throws(() => domain.buildOrganizationWorkScope(''), /未选择组织/)

  assert.deepEqual(domain.buildTaskScopeOptions(false), [{ label: '我的任务', value: 'mine' }])
  assert.deepEqual(domain.buildTaskScopeOptions(true), [
    { label: '我的任务', value: 'mine' },
    { label: '团队任务', value: 'team' },
  ])

  assert.deepEqual(domain.getAssignmentActions('pending'), ['accept', 'reject'])
  assert.deepEqual(domain.getAssignmentActions('in_progress'), ['complete'])
  assert.deepEqual(domain.getAssignmentActions('completed'), [])
  assert.deepEqual(domain.getAssignmentActions('rejected'), [])
  assert.deepEqual(domain.getAssignmentActions('cancelled'), [])
  assert.deepEqual(domain.getAssignmentActions('unexpected'), [])

  assert.deepEqual(domain.getTaskActions({ can_manage: true, status: 'active' }), ['cancel'])
  assert.deepEqual(domain.getTaskActions({ can_manage: false, status: 'active' }), [])
  assert.deepEqual(domain.getTaskActions({ can_manage: true, status: 'completed' }), [])

  assert.deepEqual(domain.getAnnouncementActions({
    can_manage: false,
    is_acknowledged: false,
    is_recipient: true,
    require_acknowledgement: true,
    status: 'published',
  }, '2026-09-06T10:00:00.000Z'), ['acknowledge'])
  assert.deepEqual(domain.getAnnouncementActions({
    can_manage: true,
    is_acknowledged: false,
    is_recipient: true,
    require_acknowledgement: true,
    status: 'published',
  }, '2026-09-06T10:00:00.000Z'), ['acknowledge', 'withdraw'])
  assert.deepEqual(domain.getAnnouncementActions({
    can_manage: true,
    is_acknowledged: false,
    require_acknowledgement: false,
    status: 'draft',
  }), ['publish'])
  assert.deepEqual(domain.getAnnouncementActions({
    can_manage: true,
    expires_at: '2026-09-06T09:59:59.000Z',
    is_acknowledged: false,
    is_recipient: true,
    require_acknowledgement: true,
    status: 'published',
  }, '2026-09-06T10:00:00.000Z'), ['withdraw'])
  assert.deepEqual(domain.getAnnouncementActions({
    can_manage: false,
    is_acknowledged: false,
    is_recipient: false,
    require_acknowledgement: true,
    status: 'published',
  }, '2026-09-06T10:00:00.000Z'), [])
  assert.deepEqual(domain.getAnnouncementActions({
    can_manage: true,
    is_acknowledged: true,
    require_acknowledgement: true,
    status: 'withdrawn',
  }), [])
})

test('创建范围包含全组织及全部有权团队，不替用户默认截断为第一个团队', async () => {
  const domain = await import('../src/domain/organization-work.ts')
  assert.equal(typeof domain.buildOrganizationWorkManageScopeOptions, 'function')

  assert.deepEqual(domain.buildOrganizationWorkManageScopeOptions({
    organizationManage: true,
    teamIds: [],
    teams: [
      { id: 12, name: '租赁一组' },
      { id: 8, name: '运营二组' },
      { id: 12, name: '重复团队' },
    ],
  }), [
    { label: '全组织', value: 'organization', teamId: undefined },
    { label: '租赁一组', value: 'team:12', teamId: 12 },
    { label: '运营二组', value: 'team:8', teamId: 8 },
  ])
  assert.deepEqual(domain.buildOrganizationWorkManageScopeOptions({
    organizationManage: false,
    teamIds: [5, 9, 5],
    teams: [
      { id: 9, name: '运营九组' },
      { id: 11, name: '无管理权限团队' },
      { id: 5, name: '租赁五组' },
    ],
  }), [
    { label: '租赁五组', value: 'team:5', teamId: 5 },
    { label: '运营九组', value: 'team:9', teamId: 9 },
  ])
  assert.deepEqual(domain.buildOrganizationWorkManageScopeOptions({ organizationManage: false, teamIds: [], teams: [] }), [])
})

test('截止时间使用本地年月日构造并严格拒绝不存在的日期', async () => {
  const domain = await import('../src/domain/organization-work.ts')
  assert.equal(typeof domain.buildOrganizationWorkDueAtIso, 'function')
  assert.equal(domain.buildOrganizationWorkDueAtIso({ year: 2026, month: 9, day: 8, hour: 18, minute: 30 }), new Date(2026, 8, 8, 18, 30).toISOString())
  for (const input of [
    { year: 2026, month: 2, day: 30, hour: 18, minute: 30 },
    { year: 2026, month: 13, day: 1, hour: 18, minute: 30 },
    { year: 2026, month: 9, day: 8, hour: 24, minute: 0 },
    { year: 2026, month: 9, day: 8, hour: 18, minute: 60 },
  ])
    assert.throws(() => domain.buildOrganizationWorkDueAtIso(input), /截止时间无效/)

  const domainSource = readFileSync(domainPath, 'utf8')
  assert.match(domainSource, /new Date\(input\.year, input\.month - 1, input\.day, input\.hour, input\.minute\)/)
  assert.doesNotMatch(domainSource, /toISOString\(\)\.slice/)
})

test('分页收集器遍历全部页面并按业务键稳定去重', async () => {
  const collectorPath = join(sourceRoot, 'shared/pagination/collectAllPages.ts')
  assert.equal(existsSync(collectorPath), true, 'shared/pagination/collectAllPages.ts 应存在')
  const { collectAllPages } = await import('../src/shared/pagination/collectAllPages.ts')
  const calls: Array<{ page: number, pageSize: number }> = []
  const items = await collectAllPages(async ({ page, pageSize }) => {
    calls.push({ page, pageSize })
    return page === 1
      ? { items: [{ id: 1 }, { id: 2 }], total: 3, page: 1, page_size: pageSize }
      : { items: [{ id: 2 }, { id: 3 }], total: 3, page: 2, page_size: pageSize }
  }, { pageSize: 2, getKey: (item: { id: number }) => item.id })

  assert.deepEqual(calls, [{ page: 1, pageSize: 2 }, { page: 2, pageSize: 2 }])
  assert.deepEqual(items, [{ id: 1 }, { id: 2 }, { id: 3 }])
})

test('候选人请求只应用最后范围且旧请求结束不关闭新请求 loading', async () => {
  const { useAsyncTask } = await import('../src/shared/composables/useAsyncTask.ts')
  let resolveFirst: (value: number[]) => void = () => undefined
  let resolveSecond: (value: number[]) => void = () => undefined
  const first = new Promise<number[]>((resolve) => {
    resolveFirst = resolve
  })
  const second = new Promise<number[]>((resolve) => {
    resolveSecond = resolve
  })
  const query = useAsyncTask((scope: string) => scope === 'first' ? first : second)

  const firstRun = query.run('first')
  const secondRun = query.run('second')
  resolveFirst([1])
  await firstRun
  assert.equal(query.data.value, null)
  assert.equal(query.loading.value, true)

  resolveSecond([2])
  await secondRun
  assert.deepEqual(query.data.value, [2])
  assert.equal(query.loading.value, false)
})

test('候选人并发失败只提示最后范围且保留其状态', async () => {
  const { AppError } = await import('../src/core/errors/app-error.ts')
  const { createLatestRequestGuard, useAsyncTask } = await import('../src/shared/composables/useAsyncTask.ts')
  let rejectFirst: (reason?: unknown) => void = () => undefined
  let rejectSecond: (reason?: unknown) => void = () => undefined
  const first = new Promise<number[]>((_resolve, reject) => {
    rejectFirst = reject
  })
  const second = new Promise<number[]>((_resolve, reject) => {
    rejectSecond = reject
  })
  const query = useAsyncTask((scope: string) => scope === 'first' ? first : second)
  const requestGuard = createLatestRequestGuard()
  const toastMessages: string[] = []

  async function loadCandidates(scope: string) {
    const generation = requestGuard.begin()
    query.data.value = []
    try {
      await query.run(scope)
    }
    catch (error) {
      if (requestGuard.isCurrent(generation))
        toastMessages.push(error instanceof Error ? error.message : '执行人加载失败')
    }
  }

  const firstRun = loadCandidates('first')
  const secondRun = loadCandidates('second')
  const secondError = new AppError({ kind: 'business', message: '范围 B 加载失败' })
  rejectSecond(secondError)
  await secondRun

  assert.deepEqual(toastMessages, ['范围 B 加载失败'])
  assert.deepEqual(query.data.value, [])
  assert.equal(query.loading.value, false)
  assert.equal(query.error.value, secondError)

  rejectFirst(new AppError({ kind: 'business', message: '范围 A 加载失败' }))
  await firstRun

  assert.deepEqual(toastMessages, ['范围 B 加载失败'])
  assert.deepEqual(query.data.value, [])
  assert.equal(query.loading.value, false)
  assert.equal(query.error.value, secondError)

  const invalidatedGeneration = requestGuard.begin()
  requestGuard.invalidate()
  assert.equal(requestGuard.isCurrent(invalidatedGeneration), false)
})

test('公告过期与个人确认标签使用确定性当前时间判断', async () => {
  const domain = await import('../src/domain/organization-work.ts')
  assert.equal(typeof domain.isOrganizationAnnouncementExpired, 'function')
  assert.equal(typeof domain.shouldShowAnnouncementAcknowledgement, 'function')
  const now = '2026-09-06T10:00:00.000Z'

  assert.equal(domain.isOrganizationAnnouncementExpired(undefined, now), false)
  assert.equal(domain.isOrganizationAnnouncementExpired('2026-09-06T10:00:01.000Z', now), false)
  assert.equal(domain.isOrganizationAnnouncementExpired('2026-09-06T10:00:00.000Z', now), true)
  assert.equal(domain.shouldShowAnnouncementAcknowledgement({
    expires_at: '2026-09-06T10:00:01.000Z',
    is_recipient: true,
    require_acknowledgement: true,
    status: 'published',
  }, now), true)

  for (const announcement of [
    { expires_at: '2026-09-06T09:59:59.000Z', is_recipient: true, require_acknowledgement: true, status: 'published' },
    { expires_at: undefined, is_recipient: false, require_acknowledgement: true, status: 'published' },
    { expires_at: undefined, is_recipient: true, require_acknowledgement: true, status: 'draft' },
    { expires_at: undefined, is_recipient: true, require_acknowledgement: true, status: 'withdrawn' },
    { expires_at: undefined, is_recipient: true, require_acknowledgement: false, status: 'published' },
  ])
    assert.equal(domain.shouldShowAnnouncementAcknowledgement(announcement, now), false)
})

test('组织协作状态 tone 与本地显示辅助提供稳定回退', async () => {
  assert.equal(existsSync(domainPath), true, 'domain/organization-work.ts 应存在')
  const domain = await import('../src/domain/organization-work.ts')

  assert.equal(domain.getAssignmentStatusTone('pending'), 'warning')
  assert.equal(domain.getAssignmentStatusTone('in_progress'), 'primary')
  assert.equal(domain.getAssignmentStatusTone('completed'), 'success')
  assert.equal(domain.getAssignmentStatusTone('rejected'), 'danger')
  assert.equal(domain.getTaskStatusTone('active'), 'primary')
  assert.equal(domain.getTaskStatusTone('completed'), 'success')
  assert.equal(domain.getTaskStatusTone('cancelled'), 'default')
  assert.equal(domain.getAnnouncementStatusTone('draft'), 'default')
  assert.equal(domain.getAnnouncementStatusTone('published'), 'primary')
  assert.equal(domain.getAnnouncementStatusTone('withdrawn'), 'warning')
  assert.equal(domain.getPriorityTone('urgent'), 'danger')
  assert.equal(domain.getPriorityTone('high'), 'warning')
  assert.equal(domain.getPriorityTone('unknown'), 'default')
  assert.equal(domain.formatOrganizationWorkDateTime(null), '--')
  assert.equal(domain.formatOrganizationWorkUser({ full_name: '张三', username: 'zhangsan' }), '张三')
  assert.equal(domain.formatOrganizationWorkUser({ full_name: '', username: 'zhangsan' }), 'zhangsan')
})

test('组织协作路由和分包声明唯一且完整', () => {
  assert.equal(routes.APP_ROUTES.organizationWork, '/pages-org-work/index')
  assert.equal(routes.APP_ROUTES.organizationTasks, '/pages-org-work/tasks/index')
  assert.equal(routes.APP_ROUTES.organizationTaskDetail, '/pages-org-work/tasks/detail')
  assert.equal(routes.APP_ROUTES.organizationAnnouncements, '/pages-org-work/announcements/index')
  assert.equal(routes.APP_ROUTES.organizationAnnouncementDetail, '/pages-org-work/announcements/detail')
  assert.equal(routes.getOrganizationTaskDetailRoute({ assignmentId: 12 }), '/pages-org-work/tasks/detail?assignmentId=12')
  assert.equal(routes.getOrganizationTaskDetailRoute({ taskId: 13 }), '/pages-org-work/tasks/detail?taskId=13')
  assert.equal(routes.getOrganizationAnnouncementDetailRoute(14), '/pages-org-work/announcements/detail?id=14')

  const pagesSource = readFileSync(join(sourceRoot, 'pages.json'), 'utf8')
  const roots = [...pagesSource.matchAll(/"root"\s*:\s*"([^"]+)"/g)].map(match => match[1])
  assert.equal(roots.length, new Set(roots).size)
  assert.equal(roots.filter(root => root === 'pages-org-work').length, 1)
  for (const page of ['index', 'tasks/index', 'tasks/detail', 'announcements/index', 'announcements/detail'])
    assert.match(pagesSource, new RegExp(`"path"\\s*:\\s*"${page}"`))
})

test('组织协作页面齐全、无占位文案，并遵守 page 到 feature 到 manual 边界', () => {
  const pagePaths = [
    'pages-org-work/index.vue',
    'pages-org-work/tasks/index.vue',
    'pages-org-work/tasks/detail.vue',
    'pages-org-work/announcements/index.vue',
    'pages-org-work/announcements/detail.vue',
  ]
  const featurePath = join(sourceRoot, 'features/organization-work/service.ts')
  const manualPath = join(sourceRoot, 'services/manual/organization-work.ts')

  for (const relativePath of pagePaths) {
    const path = join(sourceRoot, relativePath)
    assert.equal(existsSync(path), true, `${relativePath} 应存在`)
    const source = readFileSync(path, 'utf8')
    assert.equal(source.includes('@/services/openapi'), false, `${relativePath} 不得直接导入 OpenAPI`)
    assert.equal(/uni\.(?:request|uploadFile|login)\s*\(/.test(source), false, `${relativePath} 不得直接调用底层网络`)
    assert.equal(/敬请期待|归入分包|占位/.test(source), false, `${relativePath} 不得包含占位文案`)
    assert.equal(source.includes('@/features/organization-work/service'), true, `${relativePath} 应通过 feature service 读取数据`)
  }

  assert.equal(existsSync(featurePath), true)
  assert.equal(existsSync(manualPath), true)
  const featureSource = readFileSync(featurePath, 'utf8')
  const manualSource = readFileSync(manualPath, 'utf8')
  assert.equal(featureSource.includes('@/services/openapi'), false)
  assert.equal(featureSource.includes('@/services/manual/organization-work'), true)
  assert.match(featureSource, /listOrganizationWorkTeams/)
  assert.match(featureSource, /listAllOrganizationTaskAssignees/)
  assert.equal(manualSource.includes('@/services/openapi/tuanduiyunying'), true)
  assert.equal(manualSource.includes('@/services/openapi/jichu'), true)
  assert.match(manualSource, /teamsUsingGet/)
  assert.match(manualSource, /requestAllOrganizationWorkTeams/)
  assert.match(manualSource, /requestAllOrganizationTaskAssignees/)
  assert.match(manualSource, /collectAllPages/)
  assert.match(manualSource, /page_size/)
  assert.match(manualSource, /while\s*\(/)
  assert.equal(manualSource.includes('buildOrganizationWorkScope'), true)
  assert.match(manualSource, /buildOrganizationWorkScope\(organizationSlug, 'never'\)/)

  const architectureSource = readFileSync(join(testsDirectory, 'architecture-boundaries.test.ts'), 'utf8')
  assert.match(architectureSource, /pages-org-work/)
})

test('任务与公告列表支持刷新分页，reset 查询可抢占旧请求', () => {
  for (const relativePath of ['pages-org-work/tasks/index.vue', 'pages-org-work/announcements/index.vue']) {
    const path = join(sourceRoot, relativePath)
    assert.equal(existsSync(path), true, `${relativePath} 应存在`)
    const source = readFileSync(path, 'utf8')
    assert.match(source, /onPullDownRefresh/)
    assert.match(source, /onReachBottom/)
    assert.match(source, /usePagedQuery/)
    assert.match(source, /\.refresh\(\)/)
    assert.match(source, /\.loadMore\(\)/)
  }
})

test('分页查询的新 refresh 可抢占未完成的旧请求，旧响应不会覆盖新查询', async () => {
  const { usePagedQuery } = await import('../src/shared/composables/usePagedQuery.ts')
  const pending: Array<{
    page: number
    resolve: (value: { items: number[], total: number, page: number, page_size: number }) => void
  }> = []
  const query = usePagedQuery<number>(({ page, pageSize }) => new Promise((resolve) => {
    pending.push({ page, resolve: value => resolve({ ...value, page_size: pageSize }) })
  }))

  const older = query.refresh()
  await Promise.resolve()
  const newer = query.refresh()
  await Promise.resolve()

  assert.equal(pending.length, 2, '第二次 refresh 应立即发起新请求')
  pending[1].resolve({ items: [2], total: 1, page: 1, page_size: 20 })
  await newer
  pending[0].resolve({ items: [1], total: 1, page: 1, page_size: 20 })
  await older

  assert.deepEqual(query.items.value, [2])
  assert.equal(query.loading.value, false)
})

test('详情页只暴露后端允许的动作并提供提交锁与结果填写', () => {
  const taskDetailPath = join(sourceRoot, 'pages-org-work/tasks/detail.vue')
  const announcementDetailPath = join(sourceRoot, 'pages-org-work/announcements/detail.vue')
  assert.equal(existsSync(taskDetailPath), true)
  assert.equal(existsSync(announcementDetailPath), true)

  const taskSource = readFileSync(taskDetailPath, 'utf8')
  assert.match(taskSource, /assignmentId/)
  assert.match(taskSource, /taskId/)
  assert.match(taskSource, /getAssignmentActions/)
  assert.match(taskSource, /getTaskActions/)
  assert.match(taskSource, /result/)
  assert.match(taskSource, /submitting/)

  const announcementSource = readFileSync(announcementDetailPath, 'utf8')
  assert.match(announcementSource, /getAnnouncementActions/)
  assert.match(announcementSource, /acknowledge/)
  assert.match(announcementSource, /publish/)
  assert.match(announcementSource, /withdraw/)
  assert.match(announcementSource, /submitting/)
})

test('创建任务与公告必须显式选择全部有权范围，任务候选人跟随团队范围', () => {
  const taskSource = readFileSync(join(sourceRoot, 'pages-org-work/tasks/index.vue'), 'utf8')
  const announcementSource = readFileSync(join(sourceRoot, 'pages-org-work/announcements/index.vue'), 'utf8')

  for (const source of [taskSource, announcementSource]) {
    assert.match(source, /buildOrganizationWorkManageScopeOptions/)
    assert.match(source, /listOrganizationWorkTeams/)
    assert.match(source, /organizationTeams/)
    assert.match(source, /teams:\s*organizationTeams\.value/)
    assert.match(source, /createScopeOptions/)
    assert.match(source, /selectedCreateScope/)
    assert.match(source, /wd-picker/)
    assert.match(source, /selectedCreateScope\.value = event\.value/)
    assert.doesNotMatch(source, /team_ids\?\.\[0\]/)
    assert.doesNotMatch(source, /option\.payload\.label/)
    assert.match(source, /option\.label/)
  }
  assert.match(taskSource, /team_id:\s*selectedCreateTeamId\.value/)
  assert.match(taskSource, /listAllOrganizationTaskAssignees[\s\S]+team_id:\s*selectedCreateTeamId\.value/)
  assert.match(taskSource, /useAsyncTask/)
  assert.match(taskSource, /createLatestRequestGuard/)
  assert.match(taskSource, /const candidateRequestGuard = createLatestRequestGuard\(\)/)
  assert.match(taskSource, /const generation = candidateRequestGuard\.begin\(\)/)
  assert.match(taskSource, /candidateRequestGuard\.isCurrent\(generation\)/)
  assert.match(taskSource, /candidateRequestGuard\.invalidate\(\)/)
  assert.match(taskSource, /candidateQuery\.data/)
  assert.match(taskSource, /candidateQuery\.loading/)
  assert.doesNotMatch(taskSource, /candidateQuery\.error\.value/)
  assert.doesNotMatch(taskSource, /finally\s*\{\s*candidatesLoading\.value\s*=\s*false/)
  assert.match(taskSource, /wd-datetime-picker/)
  assert.match(taskSource, /buildOrganizationWorkDueAtIso/)
  assert.doesNotMatch(taskSource, /new Date\(taskDueAt\.value\.trim\(\)\)/)
  assert.match(announcementSource, /team_id:\s*selectedCreateTeamId\.value/)
})

test('公告个人确认标签复用领域可见性判断，任务取消使用全局提交锁', () => {
  const taskSource = readFileSync(join(sourceRoot, 'pages-org-work/tasks/index.vue'), 'utf8')
  const dashboardSource = readFileSync(join(sourceRoot, 'pages-org-work/index.vue'), 'utf8')
  const announcementListSource = readFileSync(join(sourceRoot, 'pages-org-work/announcements/index.vue'), 'utf8')
  const announcementDetailSource = readFileSync(join(sourceRoot, 'pages-org-work/announcements/detail.vue'), 'utf8')

  assert.match(dashboardSource, /shouldShowAnnouncementAcknowledgement\(item\)/)
  assert.match(announcementListSource, /shouldShowAnnouncementAcknowledgement\(item\)/)
  assert.match(announcementDetailSource, /shouldShowAnnouncementAcknowledgement\(announcement, now\)/)
  assert.match(taskSource, /const cancellingTaskId = ref<number \| null>\(null\)/)
  assert.match(taskSource, /if \(cancellingTaskId\.value\)/)
  assert.match(taskSource, /:disabled="cancellingTaskId !== null"/)
  assert.match(taskSource, /:loading="cancellingTaskId === item\.id"/)
})

test('组织协作页面从 Wot Toast 直接入口导入，避免根入口拖入无关类型', () => {
  for (const relativePath of [
    'pages-org-work/tasks/index.vue',
    'pages-org-work/tasks/detail.vue',
    'pages-org-work/announcements/index.vue',
    'pages-org-work/announcements/detail.vue',
  ]) {
    const source = readFileSync(join(sourceRoot, relativePath), 'utf8')
    assert.doesNotMatch(source, /from ['"]@wot-ui\/ui['"]/)
    assert.match(source, /from ['"]@wot-ui\/ui\/components\/wd-toast['"]/)
  }
})

test('公告详情跨过有效期后隐藏确认动作并清理响应式时钟', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-work/announcements/detail.vue'), 'utf8')
  assert.match(source, /const now = ref\(Date\.now\(\)\)/)
  assert.match(source, /getAnnouncementActions\(announcement\.value, now\.value\)/)
  assert.match(source, /shouldShowAnnouncementAcknowledgement\(announcement, now\)/)
  assert.match(source, /setInterval/)
  assert.match(source, /clearInterval/)
  assert.match(source, /onUnload\(/)
  assert.match(source, /now\.value = Date\.now\(\)[\s\S]+!actions\.value\.includes\(action\)/)
})
