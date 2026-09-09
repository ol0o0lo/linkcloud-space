import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveCustomNavigationLayout } from '../src/shared/navigation/layout.ts'

test('微信胶囊按钮为自定义导航栏预留右侧空间', () => {
  assert.deepEqual(resolveCustomNavigationLayout({
    windowWidth: 390,
    statusBarHeight: 47,
    menuButton: { left: 278, top: 54, width: 87, height: 32 },
  }), {
    height: 94,
    rightInset: 124,
    topInset: 47,
  })
})

test('没有胶囊按钮信息时使用安全的默认导航高度', () => {
  assert.deepEqual(resolveCustomNavigationLayout({
    windowWidth: 390,
    statusBarHeight: 24,
  }), {
    height: 68,
    rightInset: 24,
    topInset: 24,
  })
})
