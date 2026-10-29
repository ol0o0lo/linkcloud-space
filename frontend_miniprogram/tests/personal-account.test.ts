import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  buildProfilePatch,
  createWithdrawalRequestId,
  formatWalletAmount,
  getRealNameAction,
  getRealNameHint,
  getRealNameStatusLabel,
  getRealNameTone,
  getReferralStatusLabel,
  getWalletEntryTypeLabel,
  getWithdrawalActions,
  getWithdrawalAmountLabel,
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

test('实名认证完成后不占用首页常用入口，其它状态提供对应提示', () => {
  assert.equal(getRealNameHint('verified'), '')
  assert.equal(getRealNameHint('unverified'), '完善实名认证')
  assert.equal(getRealNameHint('pending'), '实名认证审核中')
  assert.equal(getRealNameHint('manual_review'), '实名认证人工复核中')
  assert.equal(getRealNameHint('rejected'), '实名认证未通过 · 查看原因')
  assert.equal(getRealNameHint('revoked'), '实名认证已撤销 · 重新认证')
  assert.equal(getRealNameHint('unknown'), '认证状态未知 · 查看')
  assert.equal(getRealNameHint(), '认证状态未知 · 查看')
})

test('推荐、钱包和提现枚举使用面向用户的中文描述', () => {
  assert.equal(getReferralStatusLabel('pending_review'), '审核中')
  assert.equal(getReferralStatusLabel('reward_issued'), '奖励已发放')
  assert.equal(getReferralStatusLabel('unknown'), '状态未知')
  assert.equal(getWalletEntryTypeLabel('promotion_reward'), '推广奖励')
  assert.equal(getWalletEntryTypeLabel('unknown'), '其他资金变动')
  assert.equal(getWithdrawalStatusLabel('approved'), '待打款')
  assert.equal(getWithdrawalStatusLabel('paid'), '已打款')
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

test('提现金额说明区分预计到账、已打款和已终止的申请', () => {
  for (const status of ['pending_review', 'approved', 'paying'])
    assert.equal(getWithdrawalAmountLabel(status), '预计到账')
  assert.equal(getWithdrawalAmountLabel('paid'), '已打款')
  for (const status of ['cancelled', 'rejected', 'failed', 'unknown'])
    assert.equal(getWithdrawalAmountLabel(status), '扣费后金额')
  assert.equal(getWithdrawalAmountLabel(), '扣费后金额')
})

test('个人账号深页有稳定路由且必须登录', () => {
  assert.equal(APP_ROUTES.accountSettings, '/pages/account/settings')
  assert.equal(APP_ROUTES.profile, '/pages/account/profile')
  assert.equal(APP_ROUTES.realName, '/pages/account/real-name')
  assert.equal(APP_ROUTES.wallet, '/pages/account/wallet')
  assert.equal(APP_ROUTES.referrals, '/pages/account/referrals')
  assert.equal(isProtectedAccountRoute(APP_ROUTES.phoneVerification), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.accountSettings), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.profile), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.realName), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.wallet), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.referrals), true)
  assert.equal(isProtectedAccountRoute(APP_ROUTES.notificationPreferences), true)
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
  for (const route of ['accountSettings', 'realName', 'wallet', 'referrals', 'notificationPreferences'])
    assert.match(meSource, new RegExp(`APP_ROUTES\\.${route}`))

  assert.match(meSource, /AppCustomNavigation[^>]*align="start"[^>]*scroll-mode="fade"/)
  assert.match(meSource, /AppModeSwitcher[^>]*variant="navigation"/)
  assert.doesNotMatch(meSource, /AppModeSwitcher[^>]*variant="compact"/)
  assert.doesNotMatch(meSource, /title="邮箱"/)
  assert.doesNotMatch(meSource, /title="手机号"/)
  assert.doesNotMatch(meSource, /handleLogout/)
  assert.doesNotMatch(meSource, /退出登录/)
  assert.match(meSource, /i-carbon-store/)
  assert.match(meSource, /i-carbon-settings-adjust/)
  assert.doesNotMatch(meSource, /profile-decoration/)
  assert.doesNotMatch(meSource, /profile-context/)

  const modeSwitcherSource = readFileSync(resolve(process.cwd(), 'src/pages/me/components/AppModeSwitcher.vue'), 'utf8')
  assert.match(modeSwitcherSource, /v-if="variant !== 'compact' \|\| canSwitch"/)
  assert.match(modeSwitcherSource, /v-if="showTrigger && variant === 'navigation'"/)
  assert.match(modeSwitcherSource, /navigation-trigger--switchable/)
  assert.match(modeSwitcherSource, /navigation-trigger__identity/)
  assert.match(modeSwitcherSource, /navigation-trigger__glyph/)
  assert.match(modeSwitcherSource, /navigation-trigger__title/)
  assert.match(modeSwitcherSource, /appContextStore\.modePresentation\.title/)
  assert.match(modeSwitcherSource, /currentModeIconClass/)
  assert.match(modeSwitcherSource, /i-carbon-search-locate/)
  assert.match(modeSwitcherSource, /i-carbon-home/)
  assert.match(modeSwitcherSource, /i-carbon-building/)
  assert.match(modeSwitcherSource, /i-carbon-chevron-down/)
  assert.match(modeSwitcherSource, /class="navigation-trigger__pill\s[^"]*\brounded-full\b|\.navigation-trigger__pill\s*\{[^}]*(?:border-radius:\s*999rpx|@apply[^;]+\brounded-full\b)/)
  assert.match(modeSwitcherSource, /backdrop-filter: var\(--app-navigation-backdrop-filter\)/)
  assert.match(modeSwitcherSource, /v-else-if="showTrigger && canSwitch" class="compact-trigger(?:\s[^"]*)?"/)
  assert.match(modeSwitcherSource, /i-carbon-arrows-horizontal/)
  assert.match(modeSwitcherSource, />切换</)
  assert.doesNotMatch(modeSwitcherSource, /compact-trigger--static/)
  assert.match(modeSwitcherSource, /AppBottomSheet/)
  assert.match(modeSwitcherSource, /show-handle/)
  assert.match(modeSwitcherSource, /backdrop-filter: blur/)
  assert.doesNotMatch(modeSwitcherSource, /current-workspace|正在使用/)
  assert.match(modeSwitcherSource, /otherModeOptions/)
  assert.match(modeSwitcherSource, /const canSwitch = computed\(\(\) => otherModeOptions\.value\.length > 0\)/)
  assert.match(modeSwitcherSource, /<view v-if="canSwitch" class="navigation-trigger__arrow i-carbon-chevron-down(?:\s[^"]*)?"/)
  assert.match(modeSwitcherSource, /availableOptions\.value\.filter\(option => !option\.active\)/)
  assert.match(modeSwitcherSource, /v-for="option in otherModeOptions"/)
  assert.doesNotMatch(modeSwitcherSource, /organization-group|organization-option/)
  assert.doesNotMatch(modeSwitcherSource, /\.sort\(/)
  assert.match(modeSwitcherSource, />选择身份</)
  assert.match(modeSwitcherSource, /个可切换/)
  assert.doesNotMatch(modeSwitcherSource, /WORKSPACE|选择身份后，将进入对应的服务首页|切换身份不会退出当前账号/)
  assert.match(modeSwitcherSource, /workspace-option/)
  assert.doesNotMatch(modeSwitcherSource, /wd-action-sheet/)
})

test('账户设置页集中管理资料、通知、安全和退出登录', () => {
  const settingsSource = readFileSync(resolve(process.cwd(), 'src/pages/account/settings.vue'), 'utf8')
  const messagesSource = readFileSync(resolve(process.cwd(), 'src/pages/messages/index.vue'), 'utf8')

  assert.match(settingsSource, /APP_ROUTES\.profile/)
  assert.match(settingsSource, /APP_ROUTES\.realName/)
  assert.match(settingsSource, /APP_ROUTES\.phoneVerification/)
  assert.match(settingsSource, /APP_ROUTES\.notificationPreferences/)
  assert.match(settingsSource, /APP_ROUTES\.accountSecurity/)
  assert.match(settingsSource, /sessionStore\.logout\(\)/)
  assert.match(settingsSource, /退出登录/)
  assert.match(settingsSource, /i-carbon-user-avatar/)
  assert.match(settingsSource, /i-carbon-notification/)
  assert.match(settingsSource, /i-carbon-security/)
  assert.match(settingsSource, /i-carbon-logout/)
  assert.doesNotMatch(settingsSource, /@\/services\/openapi/)
  assert.doesNotMatch(messagesSource, /APP_ROUTES\.notificationPreferences/)
  assert.doesNotMatch(messagesSource, /通知设置/)
})
