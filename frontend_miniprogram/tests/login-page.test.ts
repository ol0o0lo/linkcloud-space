import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const loginSource = readFileSync(new URL('../src/pages/auth/login.vue', import.meta.url), 'utf8')

test('登录页默认不勾选协议并在所有认证入口前校验', () => {
  assert.match(loginSource, /const agreementAccepted = ref\(false\)/)
  assert.match(loginSource, /<wd-checkbox v-model="agreementAccepted"/)
  assert.match(loginSource, /请先阅读并同意用户协议和隐私政策/)

  for (const handler of [
    'sendPhoneCode',
    'submitPhoneLogin',
    'submitPhonePasswordLogin',
    'submitWechatLogin',
  ]) {
    assert.match(loginSource, new RegExp(`(?:async )?function ${handler}\\([^)]*\\) \\{\\s+if \\(!ensureAgreementAccepted\\(\\)\\)`))
  }
})

test('登录页在 H5 和微信小程序统一使用透明自定义导航安全区', () => {
  assert.match(loginSource, /navigationStyle:\s*'custom'/)
  assert.match(loginSource, /<AppCustomNavigation title="" transparent/)
  assert.doesNotMatch(loginSource, /navigationBarBackgroundColor/)
})

test('登录页支持在验证码和密码输入完成后按回车提交', () => {
  assert.match(loginSource, /v-model="phoneCode"[^>]+confirm-type="go"[^>]+@confirm="submitPhoneLogin"/)
  assert.match(loginSource, /v-model="password"[^>]+confirm-type="go"[^>]+@confirm="submitPhonePasswordLogin"/)
})
