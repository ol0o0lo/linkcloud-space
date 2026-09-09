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
  resolveNotificationScope,
} from '../src/domain/notifications.ts'

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
