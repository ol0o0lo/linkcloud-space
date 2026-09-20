import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { isPublicRoute } from '../src/modules/registry.ts'
import { APP_ROUTES } from '../src/modules/routes.ts'

const sourceRoot = resolve(process.cwd(), 'src')

test('电脑扫码登录服务提交 scene 和 wx.login code', () => {
  const source = readFileSync(resolve(sourceRoot, 'services/manual/pc-login.ts'), 'utf8')

  assert.equal(source.includes('/api/users/auth/wechat-miniprogram/pc-login/confirm/'), true)
  assert.equal(source.includes('scene'), true)
  assert.equal(source.includes('code'), true)
  assert.equal(source.includes('scope: { kind: \'public\' }'), true)
})

test('电脑扫码登录页面自动确认并允许失败后重试', () => {
  const source = readFileSync(resolve(sourceRoot, 'pages/auth/pc-login.vue'), 'utf8')

  assert.equal(source.includes('excludeLoginPath: true'), true)
  assert.equal(source.includes('options?.scene'), true)
  assert.equal(source.includes('getWechatLoginCode'), true)
  assert.equal(source.includes('confirmMiniprogramPcLogin'), true)
  assert.equal(source.includes('@click="confirmLogin"'), true)
  assert.equal(source.includes('已确认，请返回电脑'), true)
})

test('应用路由暴露电脑扫码登录页面常量', () => {
  const source = readFileSync(resolve(sourceRoot, 'modules/routes.ts'), 'utf8')

  assert.equal(source.includes('pcLogin: \'/pages/auth/pc-login\''), true)
  assert.equal(isPublicRoute(APP_ROUTES.pcLogin), true)
})
