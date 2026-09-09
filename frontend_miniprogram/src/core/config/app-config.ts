export type AppPlatform = 'h5' | 'mp-weixin'
export type AppBuildMode = 'development' | 'production' | 'test'
export type ApiAddressMode = 'same-origin' | 'absolute'
export type WeixinEnvVersion = 'develop' | 'trial' | 'release'

export interface AppConfigInput {
  platform: AppPlatform
  buildMode: AppBuildMode
  env: Record<string, string | undefined>
  weixinEnvVersion?: WeixinEnvVersion
}

export interface AppConfig {
  appTitle: string
  platform: AppPlatform
  buildMode: AppBuildMode
  api: {
    mode: ApiAddressMode
    baseUrl: string
  }
}

function trimTrailingSlash(value: string): string {
  if (value === '/')
    return value
  return value.replace(/\/+$/, '')
}

function getWeixinBaseUrl(input: AppConfigInput): string {
  const suffix = (input.weixinEnvVersion || 'develop').toUpperCase()
  return input.env[`VITE_API_BASE_URL__WEIXIN_${suffix}`]
    || input.env[`VITE_SERVER_BASEURL__WEIXIN_${suffix}`]
    || input.env.VITE_API_BASE_URL
    || input.env.VITE_SERVER_BASEURL
    || ''
}

export function parseAppConfig(input: AppConfigInput): AppConfig {
  const apiMode = (input.platform === 'mp-weixin' ? input.env.VITE_API_MODE__WEIXIN : input.env.VITE_API_MODE__H5) as ApiAddressMode | undefined
    || input.env.VITE_API_MODE as ApiAddressMode | undefined
  if (apiMode !== 'same-origin' && apiMode !== 'absolute')
    throw new Error('VITE_API_MODE 必须显式配置为 same-origin 或 absolute')

  const rawBaseUrl = input.platform === 'mp-weixin'
    ? getWeixinBaseUrl(input)
    : input.env.VITE_API_BASE_URL || input.env.VITE_SERVER_BASEURL || (apiMode === 'same-origin' ? '/api' : '')
  const baseUrl = trimTrailingSlash(rawBaseUrl.trim())

  if (!baseUrl)
    throw new Error('API 地址未配置')

  if (input.platform === 'h5' && apiMode === 'same-origin' && !baseUrl.startsWith('/'))
    throw new Error('H5 同源 API 地址必须使用根路径')

  if (input.platform === 'mp-weixin') {
    const allowLocalHttp = input.buildMode === 'development' && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(baseUrl)
    if (apiMode !== 'absolute' || (!baseUrl.startsWith('https://') && !allowLocalHttp))
      throw new Error('微信小程序生产环境必须配置绝对 HTTPS API 地址')
  }

  if (apiMode === 'absolute' && !/^https?:\/\//.test(baseUrl))
    throw new Error('绝对 API 地址必须以 http:// 或 https:// 开头')

  return {
    appTitle: input.env.VITE_APP_TITLE?.trim() || '链云空间',
    platform: input.platform,
    buildMode: input.buildMode,
    api: { mode: apiMode, baseUrl },
  }
}
