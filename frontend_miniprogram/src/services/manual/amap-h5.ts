export interface AmapH5Marker {
  on: (event: 'click', listener: () => void) => void
  setContent: (content: string) => void
  setPosition: (position: [number, number]) => void
  setTop: (isTop: boolean) => void
}

export interface AmapH5Circle {}

export interface AmapH5LngLat {
  getLat: () => number
  getLng: () => number
}

export interface AmapH5Bounds {
  getNorthEast: () => AmapH5LngLat
  getSouthWest: () => AmapH5LngLat
}

export interface AmapH5Map {
  add: (overlays: AmapH5Marker | AmapH5Circle | Array<AmapH5Marker | AmapH5Circle>) => void
  addControl: (control: unknown) => void
  destroy: () => void
  getBounds: () => AmapH5Bounds
  getZoom: () => number
  on: (event: 'click' | 'moveend' | 'zoomend', listener: (event: { lnglat?: AmapH5LngLat }) => void) => void
  panTo: (position: [number, number]) => void
  remove: (overlays: AmapH5Marker | AmapH5Circle | Array<AmapH5Marker | AmapH5Circle>) => void
  resize: () => void
  setFitView: (overlays?: AmapH5Marker[], immediately?: boolean, avoid?: number[], maxZoom?: number) => void
  setZoom: (zoom: number) => void
  setZoomAndCenter: (zoom: number, center: [number, number], immediately?: boolean) => void
}

export interface AmapH5Namespace {
  Circle: new (options: Record<string, unknown>) => AmapH5Circle
  Map: new (container: string | HTMLElement, options: Record<string, unknown>) => AmapH5Map
  Marker: new (options: Record<string, unknown>) => AmapH5Marker
  Scale: new (options?: Record<string, unknown>) => unknown
  ToolBar: new (options?: Record<string, unknown>) => unknown
}

interface LoadAmapH5Options {
  key: string
  securityJsCode?: string
  plugins?: string[]
}

interface MarkerContentOptions {
  active: boolean
  childCount?: number
  houseCount: number
  level?: 'city' | 'district' | 'estate' | 'building'
  minRent: number | null
  name?: string
}

declare global {
  interface Window {
    AMap?: AmapH5Namespace
    _AMapSecurityConfig?: {
      securityJsCode: string
    }
  }
}

let amapPromise: Promise<AmapH5Namespace> | null = null

export function buildAmapH5ScriptUrl(key: string, callback: string, plugins: string[] = []): string {
  const params = new URLSearchParams({
    v: '2.0',
    key,
    callback,
  })
  const uniquePlugins = Array.from(new Set(plugins.filter(Boolean)))
  if (uniquePlugins.length)
    params.set('plugin', uniquePlugins.join(','))
  return `https://webapi.amap.com/maps?${params.toString()}`
}

export function buildAmapH5MarkerContent(options: MarkerContentOptions): string {
  const activeClass = options.active ? ' house-h5-map-marker--active' : ''
  const childLabels = { city: '个区域', district: '个小区', estate: '栋楼', building: '套房源' } as const
  const child = options.level && options.childCount != null ? `，${options.childCount}${childLabels[options.level]}` : ''
  const name = options.name ? `<strong class="house-h5-map-marker__name">${escapeMarkerText(options.name)}</strong>` : ''
  const accessibleName = escapeMarkerText(options.name || '房源')
  if (options.level && options.level !== 'building')
    return `<div class="house-h5-map-marker house-h5-map-marker--group${activeClass}" aria-label="${accessibleName}${child}，${options.houseCount}套"><span class="house-h5-map-marker__cluster-count">${options.houseCount}<small>套</small></span>${name}</div>`
  const label = options.minRent == null ? `${options.houseCount}套` : `¥${Math.round(options.minRent).toLocaleString('zh-CN')}起`
  return `<div class="house-h5-map-marker${activeClass}" aria-label="${accessibleName}，${options.houseCount}套，${label}"><span class="house-h5-map-marker__price">${label}</span><span class="house-h5-map-marker__arrow"></span></div>`
}

function escapeMarkerText(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] || character).replace(/'/g, '&#39;')
}

export function loadAmapH5(options: LoadAmapH5Options): Promise<AmapH5Namespace> {
  if (typeof window === 'undefined' || typeof document === 'undefined')
    return Promise.reject(new Error('当前环境不支持网页地图'))
  if (!options.key)
    return Promise.reject(new Error('高德地图 JSAPI Key 未配置'))
  if (window.AMap)
    return Promise.resolve(window.AMap)
  if (amapPromise)
    return amapPromise

  if (options.securityJsCode)
    window._AMapSecurityConfig = { securityJsCode: options.securityJsCode }

  amapPromise = new Promise<AmapH5Namespace>((resolve, reject) => {
    const callbackName = `__linkcloudAmapReady_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const callbackRegistry = window as unknown as Record<string, unknown>
    const script = document.createElement('script')
    let settled = false
    let timeoutId = 0

    const clearCallback = () => {
      callbackRegistry[callbackName] = undefined
    }
    const fail = (message: string) => {
      if (settled)
        return
      settled = true
      window.clearTimeout(timeoutId)
      clearCallback()
      amapPromise = null
      reject(new Error(message))
    }
    timeoutId = window.setTimeout(() => fail('高德地图加载超时，请检查网络后重试'), 15000)

    callbackRegistry[callbackName] = () => {
      if (!window.AMap) {
        fail('高德地图 SDK 初始化失败')
        return
      }
      if (settled)
        return
      settled = true
      window.clearTimeout(timeoutId)
      clearCallback()
      resolve(window.AMap)
    }

    script.async = true
    script.dataset.linkcloudAmap = 'true'
    script.referrerPolicy = 'origin'
    script.src = buildAmapH5ScriptUrl(options.key, callbackName, options.plugins)
    script.onerror = () => fail('高德地图加载失败，请检查网络或域名白名单')
    document.head.appendChild(script)
  })

  return amapPromise
}
