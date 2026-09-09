import type { PendingAction } from '@/domain/pending-action'
import type { TenantViewingPendingPayload } from '@/domain/tenant-rental'
import type { PersistedSessionState } from '@/core/auth/session-persistence'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { createAutomaticLoginAttempt } from '@/core/auth/automatic-login'
import {
  isPersistedSessionState,
  migratePersistedSessionV0,
  migratePersistedSessionV1,
} from '@/core/auth/session-persistence'
import { getAllauthSessionToken, getAllauthUser, getPendingMfaFlow, getPendingMfaTypes, isInvalidAllauthSessionStatus } from '@/domain/auth'
import { createPendingAction, takePendingAction } from '@/domain/pending-action'
import { createVersionedStorage } from '@/infra/storage/versioned-storage'
import { platformStorage } from '@/platform'
import {
  authenticateMfaCode,
  AuthRequestError,
  confirmPhoneLoginCode,
  getAuthSession,
  getWechatLoginCode,
  loginWithEmail,
  loginWithWechatCode,
  logoutAuthSession,
  requestPhoneLoginCode,
} from '@/infra/auth/client'
import { authenticateMfaWithPasskey } from '@/infra/auth/webauthn'

export type LoginAttemptResult
  = | { kind: 'authenticated', token: string }
    | { kind: 'mfa-required', types: string[] }

const sessionPersistence = createVersionedStorage<PersistedSessionState>({
  key: 'app-session',
  version: 2,
  legacyVersion: 0,
  storage: platformStorage.session,
  validate: isPersistedSessionState,
  migrations: {
    0: migratePersistedSessionV0,
    1: migratePersistedSessionV1,
  },
})

export const useSessionStore = defineStore('app-session', () => {
  const restored = sessionPersistence.read()
  const sessionToken = ref(restored?.sessionToken || '')
  const loginFlowToken = ref('')
  const mfaPending = ref(false)
  const pendingMfaTypes = ref<string[]>([])
  const pendingAction = ref<PendingAction | null>(restored?.pendingAction || null)
  const wechatAutoLoginDisabled = ref(restored?.wechatAutoLoginDisabled || false)
  const hasSession = computed(() => Boolean(sessionToken.value))

  watch([sessionToken, pendingAction, wechatAutoLoginDisabled], () => {
    sessionPersistence.write({
      sessionToken: sessionToken.value,
      pendingAction: pendingAction.value,
      wechatAutoLoginDisabled: wechatAutoLoginDisabled.value,
    })
  }, { deep: true })

  function setSessionToken(token: string) {
    sessionToken.value = token
  }

  function clearSession() {
    sessionToken.value = ''
    clearLoginFlow()
  }

  function clearLoginFlow() {
    loginFlowToken.value = ''
    mfaPending.value = false
    pendingMfaTypes.value = []
  }

  async function validateSession() {
    if (!sessionToken.value)
      return false
    try {
      const response = await getAuthSession(sessionToken.value)
      return Boolean(getAllauthUser(response))
    }
    catch (error) {
      if (error instanceof AuthRequestError && isInvalidAllauthSessionStatus(error.statusCode)) {
        clearSession()
        return false
      }
      throw error
    }
  }

  function finishLogin(response: Parameters<typeof getAllauthSessionToken>[0], fallbackToken = '', manual = true): LoginAttemptResult {
    const token = getAllauthSessionToken(response) || fallbackToken
    if (!token)
      throw new Error('登录成功但未获取到会话凭证')
    const pendingMfa = getPendingMfaFlow(response)
    if (pendingMfa) {
      loginFlowToken.value = token
      mfaPending.value = true
      pendingMfaTypes.value = getPendingMfaTypes(response)
      return { kind: 'mfa-required', types: pendingMfaTypes.value }
    }
    if (response.status === 401)
      throw new AuthRequestError(401, response)
    setSessionToken(token)
    clearLoginFlow()
    if (manual)
      wechatAutoLoginDisabled.value = false
    return { kind: 'authenticated', token }
  }

  async function loginByEmail(email: string, password: string) {
    return finishLogin(await loginWithEmail(email, password))
  }

  async function loginByWechat(options: { automatic?: boolean } = {}) {
    const code = await getWechatLoginCode()
    return finishLogin(await loginWithWechatCode(code), '', !options.automatic)
  }

  const tryAutomaticWechatLogin = createAutomaticLoginAttempt({
    isDisabled: () => wechatAutoLoginDisabled.value,
    login: async () => {
      const result = await loginByWechat({ automatic: true })
      if (result.kind !== 'authenticated')
        throw new Error('需要完成多因素认证')
    },
  })

  async function requestPhoneCode(phoneCountryCode: string, phoneNationalNumber: string) {
    const response = await requestPhoneLoginCode(phoneCountryCode, phoneNationalNumber)
    const token = getAllauthSessionToken(response)
    if (!token)
      throw new Error('验证码已发送，但未获取到登录流程凭证')
    loginFlowToken.value = token
    mfaPending.value = false
    pendingMfaTypes.value = []
  }

  async function loginByPhoneCode(code: string) {
    if (!loginFlowToken.value)
      throw new Error('请先获取手机验证码')
    const flowToken = loginFlowToken.value
    return finishLogin(await confirmPhoneLoginCode(code, flowToken), flowToken)
  }

  async function completeMfa(code: string) {
    if (!mfaPending.value || !loginFlowToken.value)
      throw new Error('当前没有待完成的多因素认证')
    const flowToken = loginFlowToken.value
    return finishLogin(await authenticateMfaCode(code, flowToken), flowToken)
  }

  async function completeMfaByPasskey() {
    if (!mfaPending.value || !loginFlowToken.value)
      throw new Error('当前没有待完成的多因素认证')
    const flowToken = loginFlowToken.value
    return finishLogin(await authenticateMfaWithPasskey(flowToken), flowToken)
  }

  async function logout() {
    const token = sessionToken.value
    wechatAutoLoginDisabled.value = true
    clearSession()
    if (!token)
      return
    try {
      await logoutAuthSession(token)
    }
    catch {
      // 本地会话必须立即失效，远端退出失败不恢复旧 token。
    }
  }

  function deferFavorite(houseId: number, redirect: string) {
    pendingAction.value = createPendingAction('favorite-house', { houseId }, redirect)
  }

  function deferViewing(payload: TenantViewingPendingPayload, redirect: string) {
    pendingAction.value = createPendingAction('book-viewing', payload, redirect)
  }

  function clearPendingAction() {
    pendingAction.value = null
  }

  function consumePendingAction() {
    const result = takePendingAction(pendingAction.value)
    pendingAction.value = result.next
    return result.action
  }

  return {
    sessionToken,
    loginFlowToken,
    mfaPending,
    pendingMfaTypes,
    pendingAction,
    wechatAutoLoginDisabled,
    hasSession,
    setSessionToken,
    clearSession,
    validateSession,
    loginByEmail,
    loginByWechat,
    tryAutomaticWechatLogin,
    requestPhoneCode,
    loginByPhoneCode,
    completeMfa,
    completeMfaByPasskey,
    clearLoginFlow,
    logout,
    deferFavorite,
    deferViewing,
    clearPendingAction,
    consumePendingAction,
  }
})
