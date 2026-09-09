export type PlatformCapabilityResult<T>
  = | { supported: true, value: T }
    | { supported: false, reason: string }
