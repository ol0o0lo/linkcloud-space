import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  buildProfilePatch,
  createWithdrawalRequestId,
  formatWalletAmount,
  getRealNameAction,
  getRealNameStatusLabel,
  getRealNameTone,
  getReferralStatusLabel,
  getWalletEntryTypeLabel,
  getWithdrawalActions,
  getWithdrawalPayChannelLabel,
  getWithdrawalStatusLabel,
  validateWithdrawalAmount,
} from '../src/domain/personal-account.ts'
import { APP_ROUTES, isProtectedAccountRoute } from '../src/modules/routes.ts'

test('个人资料更新沿用管理端字段并清理空白值', () => {
  assert.deepEqual(buildProfilePatch({ nickname: ' 云房东 ', timezone: ' Asia/Shanghai ', avatarMediaId: 12 }), {
    last_name: '云房东',
    timezone: 'Asia/Shanghai',
    avatar: [{ media_id: 12, media_type: 'image' }],
  })
  assert.deepEqual(buildProfilePatch({ nickname: '租客', timezone: '', avatarMediaId: null }), {
    last_name: '租客',
    timezone: null,
  })
})

test('实名认证只在未实名、驳回或撤销时提供提交动作', () => {
  assert.equal(getRealNameAction('unverified'), 'submit')
  assert.equal(getRealNameAction('rejected'), 'retry')
  assert.equal(getRealNameAction('revoked'), 'retry')
  assert.equal(getRealNameAction('pending'), null)
  assert.equal(getRealNameAction('manual_review'), null)
  assert.equal(getRealNameAction('verified'), null)
  assert.equal(getRealNameTone('verified'), 'success')
  assert.equal(getRealNameTone('rejected'), 'danger')
  assert.equal(getRealNameTone('pending'), 'warning')
  assert.equal(getRealNameStatusLabel('unverified'), '未认证')
  assert.equal(getRealNameStatusLabel('manual_review'), '人工复核中')
  assert.equal(getRealNameStatusLabel('unknown'), '状态未知')
})

test('推荐、钱包和提现枚举使用面向用户的中文描述', () => {
  assert.equal(getReferralStatusLabel('pending_review'), '审核中')
  assert.equal(getReferralStatusLabel('reward_issued'), '奖励已发放')
  assert.equal(getReferralStatusLabel('unknown'), '状态未知')
  assert.equal(getWalletEntryTypeLabel('promotion_reward'), '推广奖励')
  assert.equal(getWalletEntryTypeLabel('unknown'), '其他资金变动')
  assert.equal(getWithdrawalStatusLabel('approved'), '待打款')
  assert.equal(getWithdrawalStatusLabel('paid'), '已到账')
  assert.equal(getWithdrawalPayChannelLabel('wechat'), '微信')
  assert.equal(getWithdrawalPayChannelLabel('unknown'), '其他方式')
})

test('钱包金额、提现动作与幂等键保持稳定', () => {
  assert.equal(formatWalletAmount(123456), '123,456')
  assert.deepEqual(getWithdrawalActions('pending_review'), ['cancel'])
  assert.deepEqual(getWithdrawalActions('failed'), [])
  assert.deepEqual(getWithdrawalActions('paid'), [])
  assert.equal(validateWithdrawalAmount(100, 100), '')
  assert.equal(validateWithdrawalAmount(101, 100), '提现金额不能超过可用余额')
  assert.equal(validateWithdrawalAmount(0, 100), '请输入大于 0 的提现金额')
  const requestId = createWithdrawalRequestId(1_788_600_000_000, 0.123456789)
  assert.match(requestId, /^wallet-[a-z0-9]+-[a-z0-9]+$/)
  assert.ok(requestId.length <= 64)
})

test('个人账号深页有稳定路由且必须登录', () => {
  assert.equal(APP_ROUTES.profile, '/pages/account/profile')
  assert.equal(APP_ROUTES.realName, '/pages/account/real-name')
  assert.equal(APP_ROUTES.wallet, '/pages/account/wallet')
  assert.equal(APP_ROUTES.referrals, '/pages/account/referrals')
  assert.equal(isProtectedAccountRoute(APP_ROUTES.phoneVerification), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.profile), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.realName), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.wallet), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.referrals), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.me), false)
})

test('个人账号适配层只导入个人接口且页面通过 feature 调用', () => {
  const manualSource = readFileSync(resolve(process.cwd(), 'src/services/manual/account.ts'), 'utf8')
  assert.doesNotMatch(manualSource, /pingtaiguanli|shimingguanli|guanli/)
  assert.match(manualSource, /kind: 'personal'/)

  for (const page of ['profile', 'real-name', 'wallet', 'referrals']) {
    const source = readFileSync(resolve(process.cwd(), `src/pages/account/${page}.vue`), 'utf8')
    assert.match(source, /@\/features\/account\/service/)
    assert.doesNotMatch(source, /@\/services\/openapi/)
    assert.doesNotMatch(source, /敬请期待|尚未接入/)
  }

  const meSource = readFileSync(resolve(process.cwd(), 'src/pages/me/me.vue'), 'utf8')
  for (const route of ['profile', 'realName', 'wallet', 'referrals'])
    assert.match(meSource, new RegExp(`APP_ROUTES\\.${route}`))
})
