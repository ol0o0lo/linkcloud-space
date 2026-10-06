import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveTabbarLabel } from '../src/domain/tabbar-label.ts'

test('动态导航的中文标题直接展示，不强制当成多语言 key', () => {
  assert.equal(resolveTabbarLabel('找房', key => `translated:${key}`), '找房')
  assert.equal(resolveTabbarLabel('%tabbar.home%', key => `translated:${key}`), 'translated:tabbar.home')
})
