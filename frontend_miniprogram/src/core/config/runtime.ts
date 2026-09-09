import type { AppBuildMode, AppConfig, AppPlatform, WeixinEnvVersion } from './app-config'
import { isH5, isMpWeixin } from '@uni-helper/uni-env'
import { prependRequestUrlPrefix } from '@/domain/request-url'
import { parseAppConfig } from './app-config'

let cachedConfig: AppConfig | null = null

function getPlatform(): AppPlatform {
  if (isH5)
    return 'h5'
  if (isMpWeixin)
    return 'mp-weixin'
  throw new Error('当前构建平台尚未接入平台适配器')
}

function getBuildMode(): AppBuildMode {
  const mode = import.meta.env.MODE
  if (mode === 'production' || mode === 'test')
    return mode
  return 'development'
}

function getWeixinEnvVersion(platform: AppPlatform): WeixinEnvVersion | undefined {
  if (platform !== 'mp-weixin')
    return undefined
  try {
    return uni.getAccountInfoSync().miniProgram.envVersion as WeixinEnvVersion
  }
  catch {
    return 'develop'
  }
}

export function getRuntimeAppConfig(): AppConfig {
  if (cachedConfig)
    return cachedConfig
  const platform = getPlatform()
  cachedConfig = parseAppConfig({
    platform,
    buildMode: getBuildMode(),
    env: import.meta.env as unknown as Record<string, string | undefined>,
    weixinEnvVersion: getWeixinEnvVersion(platform),
  })
  return cachedConfig
}

export function resolveApiUrl(url: string): string {
  return prependRequestUrlPrefix(url, getRuntimeAppConfig().api.baseUrl)
}
