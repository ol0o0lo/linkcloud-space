import assert from 'node:assert/strict'
import test from 'node:test'

import { filterVisibleModules } from '../src/domain/navigation.ts'

const modules = [
  { key: 'home', title: '首页', route: '/pages/index/index', modes: ['visitor', 'personal'], enabled: true, requiresAuth: false, order: 10 },
  { key: 'favorites', title: '我的找房', route: '/pages/favorites/index', modes: ['personal'], enabled: true, requiresAuth: true, order: 20 },
  { key: 'analytics', title: '经营分析', route: '/pages/workspace/index', modes: ['organization'], enabled: true, requiresAuth: true, capability: 'analytics', order: 30 },
  { key: 'messages', title: '消息', route: '/pages/messages/index', modes: ['personal'], enabled: false, requiresAuth: true, order: 40 },
] as const

test('游客只看到已启用且无需登录的游客模块', () => {
  assert.deepEqual(filterVisibleModules(modules, { mode: 'visitor', authenticated: false, capabilities: {} }).map(item => item.key), ['home'])
})

test('未启用模块不会进入导航', () => {
  assert.equal(filterVisibleModules(modules, { mode: 'personal', authenticated: true, capabilities: {} }).some(item => item.key === 'messages'), false)
})

test('组织能力为假时隐藏对应模块', () => {
  assert.equal(filterVisibleModules(modules, { mode: 'organization', authenticated: true, capabilities: { analytics: false } }).length, 0)
  assert.deepEqual(filterVisibleModules(modules, { mode: 'organization', authenticated: true, capabilities: { analytics: true } }).map(item => item.key), ['analytics'])
})
