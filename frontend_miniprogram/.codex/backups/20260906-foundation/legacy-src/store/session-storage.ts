import { isH5 } from '@uni-helper/uni-env'

function migrateLegacyH5Session(key: string): string | null {
  const currentValue = window.sessionStorage.getItem(key)
  if (currentValue !== null) {
    window.localStorage.removeItem(key)
    return currentValue
  }

  const legacyValue = window.localStorage.getItem(key)
  if (legacyValue === null)
    return null

  window.sessionStorage.setItem(key, legacyValue)
  window.localStorage.removeItem(key)
  return legacyValue
}

/**
 * 小程序需要跨启动恢复会话；H5 只在当前浏览器标签页恢复，避免长期凭证落入 localStorage。
 */
export const sessionPersistenceStorage = {
  getItem(key: string): string | null {
    if (isH5 && typeof window !== 'undefined')
      return migrateLegacyH5Session(key)
    const value = uni.getStorageSync(key)
    return value ? String(value) : null
  },
  setItem(key: string, value: string) {
    if (isH5 && typeof window !== 'undefined') {
      window.sessionStorage.setItem(key, value)
      window.localStorage.removeItem(key)
      return
    }
    uni.setStorageSync(key, value)
  },
  removeItem(key: string) {
    if (isH5 && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(key)
      window.localStorage.removeItem(key)
      return
    }
    uni.removeStorageSync(key)
  },
}
