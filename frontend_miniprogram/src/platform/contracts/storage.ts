export interface PlatformStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface PlatformStorageAdapters {
  session: PlatformStorage
  persistent: PlatformStorage
}
