import type { PlatformAuthAdapter } from '../contracts/auth'

export const weixinAuthAdapter: PlatformAuthAdapter = {
  getLoginCredential: () => new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success(result) {
        if (result.code)
          resolve({ supported: true, value: result.code })
        else
          reject(new Error('微信登录未返回有效凭证'))
      },
      fail: reject,
    })
  }),
}
