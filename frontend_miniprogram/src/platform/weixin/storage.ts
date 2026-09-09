import type { PlatformStorage, PlatformStorageAdapters } from '../contracts/storage'

const persistent: PlatformStorage = {
  getItem(key) {
    const value = uni.getStorageSync(key)
    return value === undefined || value === null || value === '' ? null : String(value)
  },
  setItem: (key, value) => uni.setStorageSync(key, value),
  removeItem: key => uni.removeStorageSync(key),
}

export const weixinStorageAdapters: PlatformStorageAdapters = {
  session: persistent,
  persistent,
}
