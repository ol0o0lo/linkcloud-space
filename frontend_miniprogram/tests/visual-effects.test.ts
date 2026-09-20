import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveH5VisualEffectsMode } from '../src/platform/h5/visual-effects.ts'
import { resolveWeixinVisualEffectsMode } from '../src/platform/weixin/visual-effects.ts'

test('微信低档机关闭高成本视觉效果，其他档位保持完整效果', () => {
  assert.equal(resolveWeixinVisualEffectsMode(3), 'reduced')
  assert.equal(resolveWeixinVisualEffectsMode(2), 'full')
  assert.equal(resolveWeixinVisualEffectsMode(1), 'full')
  assert.equal(resolveWeixinVisualEffectsMode(0), 'full')
})

test('H5 在不支持模糊或用户偏好减少透明效果时自动降级', () => {
  assert.equal(resolveH5VisualEffectsMode(true, false), 'full')
  assert.equal(resolveH5VisualEffectsMode(false, false), 'reduced')
  assert.equal(resolveH5VisualEffectsMode(true, true), 'reduced')
})
