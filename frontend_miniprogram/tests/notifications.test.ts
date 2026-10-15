import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getNotificationCategoryPresentation,
  getNotificationFilterParam,
  getNotificationTone,
  isRequiredNotificationChannel,
  resolveNotificationAction,
  resolveNotificationScope,
} from '../src/domain/notifications.ts'
import {
  APP_ROUTES,
  getOrganizationAllocationDetailRoute,
  getOrganizationAnnouncementDetailRoute,
  getOrganizationTaskDetailRoute,
} from '../src/modules/routes.ts'

const testsDirectory = dirname(fileURLToPath(import.meta.url))
const sourceRoot = join(testsDirectory, '../src')

test('消息请求按个人、房东关系和组织身份区分', () => {
  assert.deepEqual(resolveNotificationScope({ mode: 'personal' }), { kind: 'personal' })
  assert.deepEqual(resolveNotificationScope({ mode: 'landlord', landlordContactId: 8 }), { kind: 'landlord', landlordContactId: 8 })
  assert.deepEqual(resolveNotificationScope({ mode: 'organization', organizationSlug: 'demo' }), { kind: 'organization', organizationSlug: 'demo' })
  assert.throws(() => resolveNotificationScope({ mode: 'visitor' }), /登录/)
  assert.throws(() => resolveNotificationScope({ mode: 'organization' }), /组织/)
})

test('消息筛选沿用后端 is_read 字符串契约', () => {
  assert.equal(getNotificationFilterParam('all'), undefined)
  assert.equal(getNotificationFilterParam('unread'), 'false')
  assert.equal(getNotificationFilterParam('read'), 'true')
})

test('消息状态和类别映射保持稳定', () => {
  assert.equal(getNotificationTone(false), 'warning')
  assert.equal(getNotificationTone(true), 'default')
  assert.deepEqual(getNotificationCategoryPresentation('team.task.assigned'), { label: '团队任务', icon: 'i-carbon-task', tone: 'warning' })
  assert.deepEqual(getNotificationCategoryPresentation('team.announcement'), { label: '团队公告', icon: 'i-carbon-notification', tone: 'primary' })
  assert.deepEqual(getNotificationCategoryPresentation('subscription.billing'), { label: '订阅与支付', icon: 'i-carbon-receipt', tone: 'success' })
  assert.deepEqual(getNotificationCategoryPresentation('unknown'), { label: '其他通知', icon: 'i-carbon-notification', tone: 'default' })
})

test('必选通知渠道不能关闭', () => {
  assert.equal(isRequiredNotificationChannel({ required_channels: ['in_app'] }, 'in_app'), true)
  assert.equal(isRequiredNotificationChannel({ required_channels: ['in_app'] }, 'email'), false)
  assert.equal(isRequiredNotificationChannel({}, 'email'), false)
})

test('结构化通知优先映射到小程序可处理业务页', () => {
  assert.deepEqual(resolveNotificationAction({ category: 'team.task.assigned', data: { assignment_id: 17, task_id: 9 } }), {
    kind: 'internal',
    route: getOrganizationTaskDetailRoute({ assignmentId: 17 }),
    label: '查看任务',
  })
  assert.deepEqual(resolveNotificationAction({ category: 'team.task.completed', data: { assignment_id: 17, task_id: 9 } }), {
    kind: 'internal',
    route: getOrganizationTaskDetailRoute({ taskId: 9 }),
    label: '查看任务',
  })
  assert.deepEqual(resolveNotificationAction({ category: 'team.announcement', data: { announcement_id: 5 } }), {
    kind: 'internal',
    route: getOrganizationAnnouncementDetailRoute(5),
    label: '查看公告',
  })
  assert.deepEqual(resolveNotificationAction({ category: 'allocation.status', data: { allocation_request_id: 23 } }), {
    kind: 'internal',
    route: getOrganizationAllocationDetailRoute(23),
    label: '查看收益申请',
  })
  assert.deepEqual(resolveNotificationAction({ category: 'subscription.billing', data: { event: 'expiring' } }), {
    kind: 'internal',
    route: APP_ROUTES.organizationAdminSubscription,
    label: '查看订阅',
  })
})

test('撤回、过期和非法业务标识的通知不产生操作', () => {
  assert.equal(resolveNotificationAction({ category: 'team.announcement', data: { announcement_id: 5, withdrawn: true } }), null)
  assert.equal(resolveNotificationAction({ category: 'team.task.assigned', data: { assignment_id: '17' } }), null)
  assert.equal(resolveNotificationAction({ category: 'allocation.status', data: { allocation_request_id: 0 } }), null)
  assert.equal(resolveNotificationAction({ category: 'subscription.billing', data: {}, expiresAt: '2026-09-08T12:00:00+08:00' }, new Date('2026-09-09T12:00:00+08:00').getTime()), null)
})

test('历史管理端链接只兼容精确白名单，HTTPS 外链保持外部动作', () => {
  assert.deepEqual(resolveNotificationAction({ category: '', data: {}, url: '/dashboard/rental/workbench/tasks?assignment_id=31' }), {
    kind: 'internal',
    route: getOrganizationTaskDetailRoute({ assignmentId: 31 }),
    label: '查看任务',
  })
  assert.deepEqual(resolveNotificationAction({ category: '', data: {}, url: '/dashboard/rental/workbench/announcements?announcement_id=7' }), {
    kind: 'internal',
    route: getOrganizationAnnouncementDetailRoute(7),
    label: '查看公告',
  })
  assert.deepEqual(resolveNotificationAction({ category: '', data: {}, url: '/dashboard/rental/earnings?tab=reviews&request=12' }), {
    kind: 'internal',
    route: getOrganizationAllocationDetailRoute(12),
    label: '查看收益申请',
  })
  assert.deepEqual(resolveNotificationAction({ category: '', data: {}, url: '/dashboard/space/subscription/orders' }), {
    kind: 'internal',
    route: APP_ROUTES.organizationAdminSubscription,
    label: '查看订阅',
  })
  assert.deepEqual(resolveNotificationAction({ category: '', data: {}, url: 'https://example.com/notice' }), {
    kind: 'external',
    url: 'https://example.com/notice',
    label: '打开链接',
  })
  assert.equal(resolveNotificationAction({ category: '', data: {}, url: 'http://example.com/insecure' }), null)
  assert.equal(resolveNotificationAction({ category: '', data: {}, url: '/dashboard/users' }), null)
  assert.equal(resolveNotificationAction({ category: '', data: {}, url: '/pages/account/profile' }), null)
})

test('消息详情仅执行领域解析后的动作', () => {
  const source = readFileSync(join(sourceRoot, 'pages/messages/detail.vue'), 'utf8')

  assert.match(source, /resolveNotificationAction/)
  assert.doesNotMatch(source, /const url = notification\.value\?\.url/)
})

test('业务消息继续处理时保留加载消息的组织，公开房源仍使用公开上下文', () => {
  const workspace = { mode: 'organization' as const, organizationSlug: 'alpha' }
  const action = resolveNotificationAction({ category: 'team.task.assigned', data: { assignment_id: 8 }, workspace })
  assert.deepEqual(action, { kind: 'internal', route: `${getOrganizationTaskDetailRoute({ assignmentId: 8 })}&organization_slug=alpha`, label: '查看任务' })
  assert.deepEqual(resolveNotificationAction({ category: 'subscription.billing', workspace }), {
    kind: 'internal',
    route: `${APP_ROUTES.organizationAdminSubscription}?organization_slug=alpha`,
    label: '查看订阅',
  })
  assert.equal(resolveNotificationAction({ category: 'house.contact', data: { house_id: 8 }, workspace })?.kind, 'internal')
  assert.doesNotMatch(JSON.stringify(resolveNotificationAction({ category: 'house.contact', data: { house_id: 8 }, workspace })), /organization_slug/)
})

test('通知详情离开页面后进行中的轮询请求不能复活定时器', () => {
  const source = readFileSync(join(sourceRoot, 'pages-org-admin/notification-dispatches/detail.vue'), 'utf8')

  assert.match(source, /createLatestRequestGuard/)
  assert.match(source, /let pageActive = false/)
  assert.match(source, /const pollingRequestGuard = createLatestRequestGuard\(\)/)
  assert.match(source, /const requestGeneration = pollingRequestGuard\.begin\(\)/)
  assert.match(source, /const organizationSlugSnapshot = appContextStore\.organizationSlug/)
  assert.match(source, /const dispatchIdSnapshot = dispatchId\.value/)
  assert.match(source, /if \(!isPollingRequestCurrent\(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot\)\)\s+return/)
  assert.match(source, /pageActive = true[\s\S]*void refreshAll\(\)/)
  assert.match(source, /pageActive = false[\s\S]*pollingRequestGuard\.invalidate\(\)/)
  assert.match(source, /onHide\(stopPolling\)/)
  assert.match(source, /onUnload\(stopPolling\)/)
})
