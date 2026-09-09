import type { PlatformCapabilityResult } from './capability'

export interface PlatformAuthAdapter {
  getLoginCredential: () => Promise<PlatformCapabilityResult<string>>
}
