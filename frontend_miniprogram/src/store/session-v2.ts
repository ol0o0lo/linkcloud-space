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
import { getAllauthSessionToken, getAllauthUser, isInvalidAllauthSessionStatus } from '@/domain/auth'
import { createPendingAction, takePendingAction } from '@/domain/pending-action'
import { createVersionedStorage } from '@/infra/storage/versioned-storage'
import { platformStorage } from '@/platform'
import {
  AuthRequestError,
  confirmPhoneLoginCode,
  getAuthSession,
  getWechatLoginCode,
  loginWithPhonePassword,
  loginWithWechatCode,
  logoutAuthSession,
  requestPhoneLoginCode,
} from '@/infra/auth/client'

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

  function finishLogin(response: Parameters<typeof getAllauthSessionToken>[0], fallbackToken = '', manual = true): string {
    const token = getAllauthSessionToken(response) || fallbackToken
    if (!token)
      throw new Error('登录成功但未获取到会话凭证')
    if (response.status === 401)
      throw new AuthRequestError(401, response)
    setSessionToken(token)
    clearLoginFlow()
    if (manual)
      wechatAutoLoginDisabled.value = false
    return token
  }

  async function loginByPhonePassword(phoneCountryCode: string, phoneNationalNumber: string, password: string) {
    return finishLogin(await loginWithPhonePassword(phoneCountryCode, phoneNationalNumber, password))
  }

  async function loginByWechat(options: { automatic?: boolean } = {}) {
    const code = await getWechatLoginCode()
    return finishLogin(await loginWithWechatCode(code), '', !options.automatic)
  }

  const tryAutomaticWechatLogin = createAutomaticLoginAttempt({
    isDisabled: () => wechatAutoLoginDisabled.value,
    login: async () => loginByWechat({ automatic: true }),
  })

  async function requestPhoneCode(phoneCountryCode: string, phoneNationalNumber: string) {
    const response = await requestPhoneLoginCode(phoneCountryCode, phoneNationalNumber)
    const token = getAllauthSessionToken(response)
    if (!token)
      throw new Error('验证码已发送，但未获取到登录流程凭证')
    loginFlowToken.value = token
  }

  async function loginByPhoneCode(code: string) {
    if (!loginFlowToken.value)
      throw new Error('请先获取手机验证码')
    const flowToken = loginFlowToken.value
    return finishLogin(await confirmPhoneLoginCode(code, flowToken), flowToken)
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
    pendingAction,
    wechatAutoLoginDisabled,
    hasSession,
    setSessionToken,
    clearSession,
    validateSession,
    loginByPhonePassword,
    loginByWechat,
    tryAutomaticWechatLogin,
    requestPhoneCode,
    loginByPhoneCode,
    clearLoginFlow,
    logout,
    deferFavorite,
    deferViewing,
    clearPendingAction,
    consumePendingAction,
  }
})
