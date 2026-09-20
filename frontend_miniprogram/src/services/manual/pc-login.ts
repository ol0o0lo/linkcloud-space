import { runtimeHttpClient } from '@/infra/http/runtime'

export interface ConfirmMiniprogramPcLoginInput {
  scene: string
  code: string
}

export function confirmMiniprogramPcLogin(input: ConfirmMiniprogramPcLoginInput) {
  return runtimeHttpClient.request<{ status: 'confirmed' }, ConfirmMiniprogramPcLoginInput>({
    url: '/api/users/auth/wechat-miniprogram/pc-login/confirm/',
    method: 'POST',
    body: input,
    scope: { kind: 'public' },
    authRetry: 'never',
  })
}
