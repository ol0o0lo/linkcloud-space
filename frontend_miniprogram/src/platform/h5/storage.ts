import type { PlatformStorageAdapters } from '../contracts/storage'

const session = {
  getItem(key: string) {
    if (typeof window === 'undefined')
      return null
    const currentValue = window.sessionStorage.getItem(key)
    if (currentValue !== null) {
      window.localStorage.removeItem(key)
      return currentValue
    }
    const legacyValue = window.localStorage.getItem(key)
    if (legacyValue !== null) {
      window.sessionStorage.setItem(key, legacyValue)
      window.localStorage.removeItem(key)
    }
    return legacyValue
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined')
      return
    window.sessionStorage.setItem(key, value)
    window.localStorage.removeItem(key)
  },
  removeItem(key: string) {
    if (typeof window === 'undefined')
      return
    window.sessionStorage.removeItem(key)
    window.localStorage.removeItem(key)
  },
}

const persistent = {
  getItem: (key: string) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  removeItem: (key: string) => window.localStorage.removeItem(key),
}

export const h5StorageAdapters: PlatformStorageAdapters = { session, persistent }
