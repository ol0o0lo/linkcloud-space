export interface KeyValueStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface VersionedStorageOptions<T> {
  key: string
  version: number
  legacyVersion?: number
  storage: KeyValueStorage
  validate: (value: unknown) => value is T
  migrations: Partial<Record<number, (value: unknown) => unknown>>
}

interface VersionedEnvelope {
  version: number
  data: unknown
}

export interface VersionedStorage<T> {
  read: () => T | null
  write: (value: T) => void
  remove: () => void
}

function parseEnvelope(raw: string, legacyVersion?: number): VersionedEnvelope | null {
  try {
    const value = JSON.parse(raw) as Partial<VersionedEnvelope>
    if (Number.isInteger(value?.version) && typeof value.version === 'number' && 'data' in value)
      return { version: value.version, data: value.data }
    return legacyVersion === undefined ? null : { version: legacyVersion, data: value }
  }
  catch {
    return null
  }
}

export function createVersionedStorage<T>(options: VersionedStorageOptions<T>): VersionedStorage<T> {
  function remove() {
    options.storage.removeItem(options.key)
  }

  function write(value: T) {
    if (!options.validate(value))
      throw new Error(`持久化数据不符合 schema：${options.key}`)
    options.storage.setItem(options.key, JSON.stringify({ version: options.version, data: value }))
  }

  function read(): T | null {
    const raw = options.storage.getItem(options.key)
    if (raw === null)
      return null

    const envelope = parseEnvelope(raw, options.legacyVersion)
    if (!envelope || envelope.version > options.version) {
      remove()
      return null
    }

    let version = envelope.version
    let data = envelope.data
    while (version < options.version) {
      const migrate = options.migrations[version]
      if (!migrate) {
        remove()
        return null
      }
      data = migrate(data)
      version += 1
    }

    if (!options.validate(data)) {
      remove()
      return null
    }

    if (envelope.version !== options.version)
      write(data)
    return data
  }

  return { read, write, remove }
}
