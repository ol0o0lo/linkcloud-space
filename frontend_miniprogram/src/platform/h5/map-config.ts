export function syncH5MapConfig(config: { amapJsapiKey?: string, amapSecurityJsCode?: string }): void {
  const uniConfig = (globalThis as typeof globalThis & {
    __uniConfig?: { aMapKey?: string, aMapSecurityJsCode?: string }
  }).__uniConfig

  if (!uniConfig || !config.amapJsapiKey)
    return

  // uni.openLocation 与 H5 map 使用这份配置，不读取应用的公共配置接口。
  uniConfig.aMapKey = config.amapJsapiKey
  uniConfig.aMapSecurityJsCode = config.amapSecurityJsCode || ''
}
