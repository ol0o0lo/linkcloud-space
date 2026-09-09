import type { PlatformAuthAdapter } from '../contracts/auth'

export const h5AuthAdapter: PlatformAuthAdapter = {
  async getLoginCredential() {
    return { supported: false, reason: 'H5 不支持微信小程序静默凭证登录' }
  },
}
