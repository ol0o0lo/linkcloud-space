import { appContextUsingGet } from '@/services/openapi/xitong'

export type { AppContextOut } from '@/services/openapi/types'

export function getPublicAppContext() {
  return appContextUsingGet({
    options: { requestScope: { kind: 'public' } },
  })
}
