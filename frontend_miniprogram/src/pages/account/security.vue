<script setup lang="ts">
import type { AccountAuthenticator, TotpSetup } from '@/features/account-security/service'
import { onHide, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { buildMfaDescription } from '@/domain/account-security'
import {
  activateTotp,
  createPasskey,
  deleteAuthenticator,
  deletePasskey,
  getWebAuthnSupport,
  isReauthenticationRequired,
  listAuthenticators,
  reauthenticate,
  reauthenticateWithPasskey,
  renamePasskey,
  startTotpSetup,
  viewRecoveryCodes,
} from '@/features/account-security/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'

definePage({ style: { navigationBarTitleText: '账号安全' } })

type ProtectedAction = () => Promise<void>

const authenticators = ref<AccountAuthenticator[]>([])
const totpSetup = ref<TotpSetup | null>(null)
const totpCode = ref('')
const recoveryCodes = ref<string[]>([])
const passkeyName = ref('')
const editingPasskeyId = ref<number | null>(null)
const loading = ref(false)
const startingTotp = ref(false)
const activatingTotp = ref(false)
const removingTotp = ref(false)
const loadingRecoveryCodes = ref(false)
const savingPasskey = ref(false)
const removingPasskeyId = ref<number | null>(null)
const loadError = ref('')
const reauthVisible = ref(false)
const reauthPassword = ref('')
const reauthSubmitting = ref(false)
const passkeyReauthSubmitting = ref(false)
const webauthnSupport = getWebAuthnSupport()
let pendingProtectedAction: ProtectedAction | null = null

const hasTotp = computed(() => authenticators.value.some(item => item.type === 'totp'))
const recoveryAuthenticator = computed(() => authenticators.value.find(item => item.type === 'recovery_codes') || null)
const passkeys = computed(() => authenticators.value.filter((item): item is AccountAuthenticator & { id: number } => item.type === 'webauthn' && typeof item.id === 'number'))
const mfaDescription = computed(() => buildMfaDescription(authenticators.value))

function showError(error: unknown, fallback: string) {
  uni.showToast({ title: error instanceof Error ? error.message : fallback, icon: 'none' })
}

async function loadSecurity() {
  loading.value = true
  loadError.value = ''
  try {
    authenticators.value = await listAuthenticators()
  }
  catch {
    loadError.value = '账号安全状态加载失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}

async function runProtectedAction(action: ProtectedAction, fallback: string) {
  try {
    await action()
  }
  catch (error) {
    if (isReauthenticationRequired(error)) {
      pendingProtectedAction = action
      reauthVisible.value = true
      return
    }
    showError(error, fallback)
  }
}

async function finishReauthentication() {
  const action = pendingProtectedAction
  pendingProtectedAction = null
  reauthVisible.value = false
  reauthPassword.value = ''
  if (action)
    await runProtectedAction(action, '操作失败，请稍后重试')
}

async function submitPasswordReauthentication() {
  if (!reauthPassword.value) {
    uni.showToast({ title: '请输入当前密码', icon: 'none' })
    return
  }
  reauthSubmitting.value = true
  try {
    await reauthenticate(reauthPassword.value)
    await finishReauthentication()
  }
  catch (error) {
    showError(error, '身份验证失败')
  }
  finally {
    reauthSubmitting.value = false
  }
}

async function submitPasskeyReauthentication() {
  if (!webauthnSupport.supported) {
    uni.showToast({ title: webauthnSupport.reason, icon: 'none' })
    return
  }
  passkeyReauthSubmitting.value = true
  try {
    await reauthenticateWithPasskey()
    await finishReauthentication()
  }
  catch (error) {
    showError(error, '通行密钥验证失败')
  }
  finally {
    passkeyReauthSubmitting.value = false
  }
}

function cancelReauthentication() {
  pendingProtectedAction = null
  reauthVisible.value = false
  reauthPassword.value = ''
}

async function beginTotpSetup() {
  startingTotp.value = true
  try {
    totpSetup.value = await startTotpSetup()
    totpCode.value = ''
  }
  catch (error) {
    showError(error, '动态验证码初始化失败')
  }
  finally {
    startingTotp.value = false
  }
}

function copyValue(value: string, successTitle: string) {
  uni.setClipboardData({
    data: value,
    success: () => uni.showToast({ title: successTitle, icon: 'success' }),
  })
}

async function showRecoveryCodes() {
  loadingRecoveryCodes.value = true
  await runProtectedAction(async () => {
    const codes = await viewRecoveryCodes()
    if (!codes.length) {
      uni.showToast({ title: '恢复码已展示过，请使用已保存的副本', icon: 'none' })
      return
    }
    recoveryCodes.value = codes
  }, '恢复码读取失败')
  loadingRecoveryCodes.value = false
}

async function confirmTotp() {
  const code = totpCode.value.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(code)) {
    uni.showToast({ title: '请输入 6 位动态验证码', icon: 'none' })
    return
  }
  activatingTotp.value = true
  await runProtectedAction(async () => {
    const result = await activateTotp(code)
    totpSetup.value = null
    totpCode.value = ''
    await loadSecurity()
    uni.showToast({ title: '动态验证码已启用', icon: 'success' })
    if (result.recoveryCodesGenerated)
      await showRecoveryCodes()
  }, '动态验证码绑定失败')
  activatingTotp.value = false
}

async function removeTotp() {
  const confirmation = await uni.showModal({
    title: '移除动态验证码',
    content: '移除后将同时清理恢复码，请确认仍有其他安全的登录方式。',
    confirmText: '确认移除',
    confirmColor: '#e64545',
  })
  if (!confirmation.confirm)
    return
  removingTotp.value = true
  try {
    await deleteAuthenticator('totp')
    if (recoveryAuthenticator.value)
      await deleteAuthenticator('recovery_codes')
    recoveryCodes.value = []
    await loadSecurity()
    uni.showToast({ title: '动态验证码与恢复码已移除', icon: 'success' })
  }
  catch (error) {
    showError(error, '动态验证码移除失败')
  }
  finally {
    removingTotp.value = false
  }
}

function beginCreatePasskey() {
  editingPasskeyId.value = 0
  passkeyName.value = ''
}

function beginRenamePasskey(item: AccountAuthenticator & { id: number }) {
  editingPasskeyId.value = item.id
  passkeyName.value = item.name || '我的通行密钥'
}

function cancelPasskeyEdit() {
  editingPasskeyId.value = null
  passkeyName.value = ''
}

async function savePasskey() {
  const name = passkeyName.value.trim()
  const editingId = editingPasskeyId.value
  if (editingId === null)
    return
  if (!name) {
    uni.showToast({ title: '请输入设备名称', icon: 'none' })
    return
  }
  if (name.length > 64) {
    uni.showToast({ title: '设备名称最多 64 个字符', icon: 'none' })
    return
  }
  if (!webauthnSupport.supported) {
    uni.showToast({ title: webauthnSupport.reason, icon: 'none' })
    return
  }
  savingPasskey.value = true
  await runProtectedAction(async () => {
    if (editingId === 0) {
      const result = await createPasskey(name)
      if (result.recoveryCodesGenerated)
        await showRecoveryCodes()
      uni.showToast({ title: '通行密钥已添加', icon: 'success' })
    }
    else {
      await renamePasskey(editingId, name)
      uni.showToast({ title: '通行密钥名称已更新', icon: 'success' })
    }
    cancelPasskeyEdit()
    await loadSecurity()
  }, editingId === 0 ? '通行密钥添加失败' : '通行密钥重命名失败')
  savingPasskey.value = false
}

async function removePasskey(item: AccountAuthenticator & { id: number }) {
  const confirmation = await uni.showModal({
    title: '删除通行密钥',
    content: `删除“${item.name || '未命名设备'}”后，这台设备将不能再使用该通行密钥登录。`,
    confirmText: '确认删除',
    confirmColor: '#e64545',
  })
  if (!confirmation.confirm)
    return
  removingPasskeyId.value = item.id
  await runProtectedAction(async () => {
    await deletePasskey(item.id)
    await loadSecurity()
    uni.showToast({ title: '通行密钥已删除', icon: 'success' })
  }, '通行密钥删除失败')
  removingPasskeyId.value = null
}

function formatTimestamp(value?: number) {
  return value ? new Date(value * 1000).toLocaleString('zh-CN', { hour12: false }) : '创建时间未知'
}

onShow(() => void loadSecurity())
onHide(() => {
  recoveryCodes.value = []
  cancelReauthentication()
})
</script>

<template>
  <view class="security-page">
    <AppLoading v-if="loading && !authenticators.length" text="正在加载账号安全状态…" />
    <AppErrorView v-else-if="loadError && !authenticators.length" :message="loadError" @retry="loadSecurity" />
    <template v-else>
      <view class="summary-card">
        <view class="summary-icon i-carbon-two-factor-authentication" />
        <view>
          <view class="summary-title">
            多因素验证（MFA）
          </view>
          <view class="summary-copy">
            {{ mfaDescription }}
          </view>
        </view>
      </view>

      <view v-if="reauthVisible" class="reauth-card">
        <view class="section-title compact">
          重新验证身份
        </view>
        <view class="section-copy">
          为保护账号安全，修改验证方式前需要再次确认身份。可输入当前密码；网页端支持时也可使用已绑定的通行密钥。
        </view>
        <wd-input v-model="reauthPassword" label="当前密码" type="safe-password" show-password placeholder="请输入当前密码" />
        <view class="button-row">
          <wd-button :loading="reauthSubmitting" @click="submitPasswordReauthentication">
            密码验证
          </wd-button>
          <!-- #ifdef H5 -->
          <wd-button v-if="passkeys.length" variant="plain" :disabled="!webauthnSupport.supported" :loading="passkeyReauthSubmitting" @click="submitPasskeyReauthentication">
            使用通行密钥验证
          </wd-button>
          <!-- #endif -->
          <wd-button variant="text" @click="cancelReauthentication">
            取消
          </wd-button>
        </view>
      </view>

      <view class="section-title">
        验证方式
      </view>
      <view class="section-card">
        <view class="section-head">
          <view>
            <view class="item-title">
              动态验证码（TOTP）
            </view>
            <view class="section-copy">
              支持 Google Authenticator、Microsoft Authenticator、1Password 等验证器应用。
            </view>
          </view>
          <wd-tag :type="hasTotp ? 'success' : 'default'" variant="light">
            {{ hasTotp ? '已启用' : '未启用' }}
          </wd-tag>
        </view>

        <template v-if="totpSetup">
          <view class="setup-card">
            <view class="setup-step">
              1. 在验证器应用中手动录入密钥，或复制完整配置链接并用支持的应用打开。
            </view>
            <view class="secret-value">
              {{ totpSetup.secret }}
            </view>
            <view class="button-row">
              <wd-button size="small" variant="plain" @click="copyValue(totpSetup.secret, '密钥已复制')">
                复制密钥
              </wd-button>
              <wd-button size="small" variant="plain" @click="copyValue(totpSetup.totpUrl, '配置链接已复制')">
                复制配置链接
              </wd-button>
            </view>
            <view class="setup-step">
              2. 输入验证器当前显示的 6 位动态验证码。
            </view>
            <wd-input v-model="totpCode" label="验证码" type="number" :maxlength="6" clearable placeholder="请输入 6 位数字" />
            <view class="button-row">
              <wd-button :loading="activatingTotp" @click="confirmTotp">
                确认绑定
              </wd-button>
              <wd-button variant="text" @click="totpSetup = null">
                取消
              </wd-button>
            </view>
          </view>
        </template>
        <view v-else class="button-row action-row">
          <wd-button v-if="!hasTotp" :loading="startingTotp" @click="beginTotpSetup">
            绑定动态验证码
          </wd-button>
          <wd-button v-else type="danger" variant="plain" :loading="removingTotp" @click="removeTotp">
            移除动态验证码
          </wd-button>
          <wd-button v-if="recoveryAuthenticator" variant="plain" :loading="loadingRecoveryCodes" @click="showRecoveryCodes">
            查看恢复码
          </wd-button>
        </view>
      </view>

      <view v-if="recoveryAuthenticator" class="recovery-status">
        恢复码：剩余 {{ recoveryAuthenticator.unused_code_count ?? '未知' }} / {{ recoveryAuthenticator.total_code_count ?? '未知' }}。恢复码默认只展示一次，请离线保存。
      </view>

      <view v-if="recoveryCodes.length" class="recovery-card">
        <view class="section-head">
          <view>
            <view class="item-title">
              请立即保存恢复码
            </view>
            <view class="section-copy">
              每条只能使用一次，离开页面后将自动隐藏。
            </view>
          </view>
          <wd-tag type="warning" variant="light">
            敏感信息
          </wd-tag>
        </view>
        <view class="code-grid">
          <text v-for="code in recoveryCodes" :key="code">
            {{ code }}
          </text>
        </view>
        <view class="button-row">
          <wd-button size="small" @click="copyValue(recoveryCodes.join('\n'), '恢复码已复制')">
            复制全部
          </wd-button>
          <wd-button size="small" variant="text" @click="recoveryCodes = []">
            隐藏
          </wd-button>
        </view>
      </view>

      <view class="section-title">
        通行密钥（Passkey）
      </view>
      <!-- #ifdef H5 -->
      <view class="section-card">
        <view class="section-head">
          <view>
            <view class="item-title">
              通行密钥
            </view>
            <view class="section-copy">
              使用设备指纹、面容或系统解锁方式验证身份，仅在支持该功能的安全网页中使用。
            </view>
          </view>
          <wd-tag :type="webauthnSupport.supported ? 'success' : 'warning'" variant="light">
            {{ webauthnSupport.supported ? '当前可用' : '当前不可用' }}
          </wd-tag>
        </view>
        <view v-if="!webauthnSupport.supported" class="capability-note">
          {{ webauthnSupport.reason }}
        </view>
        <view v-if="passkeys.length" class="passkey-list">
          <view v-for="item in passkeys" :key="item.id" class="passkey-item">
            <view class="passkey-main">
              <view class="item-title">
                {{ item.name || '未命名设备' }}
              </view>
              <view class="section-copy">
                {{ item.is_passwordless ? '可直接登录' : '用于身份验证' }} · {{ formatTimestamp(item.created_at) }}
              </view>
            </view>
            <view class="button-row compact-actions">
              <wd-button size="mini" variant="text" @click="beginRenamePasskey(item)">
                重命名
              </wd-button>
              <wd-button size="mini" type="danger" variant="text" :loading="removingPasskeyId === item.id" @click="removePasskey(item)">
                删除
              </wd-button>
            </view>
          </view>
        </view>
        <view v-else class="empty-copy">
          当前没有通行密钥
        </view>

        <view v-if="editingPasskeyId !== null" class="passkey-editor">
          <wd-input v-model="passkeyName" label="设备名称" :maxlength="64" clearable placeholder="例如：办公 MacBook" />
          <view class="button-row">
            <wd-button :loading="savingPasskey" @click="savePasskey">
              {{ editingPasskeyId === 0 ? '添加通行密钥' : '保存名称' }}
            </wd-button>
            <wd-button variant="text" @click="cancelPasskeyEdit">
              取消
            </wd-button>
          </view>
        </view>
        <wd-button v-else block variant="plain" :disabled="!webauthnSupport.supported" @click="beginCreatePasskey">
          添加通行密钥
        </wd-button>
      </view>
      <!-- #endif -->
      <!-- #ifdef MP-WEIXIN -->
      <view class="section-card capability-note">
        微信小程序暂不支持管理通行密钥。请前往安全网页端或管理端添加、重命名和删除通行密钥。
      </view>
      <!-- #endif -->
    </template>
  </view>
</template>

<style scoped lang="scss">
.security-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.summary-card,
.section-card,
.reauth-card,
.recovery-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.summary-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  background: var(--app-gradient-profile);
}
.summary-icon {
  color: var(--app-color-primary);
  font-size: 62rpx;
}
.summary-title,
.item-title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
}
.summary-copy,
.section-copy,
.empty-copy,
.capability-note,
.recovery-status {
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.65;
}
.summary-copy {
  margin-top: 6rpx;
}
.section-title {
  margin: 34rpx 8rpx 16rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  font-weight: 650;
}
.section-title.compact {
  margin: 0 0 8rpx;
}
.section-head,
.passkey-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}
.section-head > view:first-child,
.passkey-main {
  min-width: 0;
  flex: 1;
}
.section-copy {
  margin-top: 8rpx;
}
.button-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14rpx;
}
.action-row,
.setup-card .button-row,
.reauth-card .button-row,
.recovery-card .button-row,
.passkey-editor .button-row {
  margin-top: 22rpx;
}
.setup-card,
.passkey-editor,
.capability-note,
.recovery-status {
  margin-top: 22rpx;
  padding: 22rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}
.setup-step {
  margin: 12rpx 0;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.65;
}
.secret-value {
  padding: 20rpx;
  border: 1px solid var(--app-border-color);
  border-radius: 16rpx;
  color: var(--app-text-primary);
  background: var(--app-bg-card);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 27rpx;
  letter-spacing: 1rpx;
  overflow-wrap: anywhere;
}
.reauth-card,
.recovery-card {
  margin-top: 22rpx;
  border: 1px solid var(--app-border-color);
}
.code-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 22rpx;
}
.code-grid text {
  padding: 16rpx;
  border-radius: 14rpx;
  color: var(--app-text-primary);
  background: var(--app-bg-subtle);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 25rpx;
  text-align: center;
}
.passkey-list {
  margin: 22rpx 0;
  border-top: 1px solid var(--app-divider-color);
}
.passkey-item {
  padding: 22rpx 0;
  border-bottom: 1px solid var(--app-divider-color);
}
.compact-actions {
  flex-shrink: 0;
}
.empty-copy {
  padding: 30rpx 0;
  text-align: center;
}
</style>
