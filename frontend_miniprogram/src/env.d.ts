/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  /** 网站标题，应用名称 */
  readonly VITE_APP_TITLE: string
  /** H5 开发服务端口 */
  readonly VITE_APP_PORT: string
  /** H5 静态资源部署基址 */
  readonly VITE_APP_PUBLIC_BASE: string
  /** 微信小程序 App ID */
  readonly VITE_WX_APPID: string
  /** 当前默认 API 地址模式 */
  readonly VITE_API_MODE: 'same-origin' | 'absolute'
  /** 微信小程序 API 地址模式 */
  readonly VITE_API_MODE__WEIXIN?: 'absolute'
  /** H5 或默认 API 根地址 */
  readonly VITE_API_BASE_URL: string
  /** 微信开发版 API 根地址 */
  readonly VITE_API_BASE_URL__WEIXIN_DEVELOP?: string
  /** 微信体验版 API 根地址 */
  readonly VITE_API_BASE_URL__WEIXIN_TRIAL?: string
  /** 微信正式版 API 根地址 */
  readonly VITE_API_BASE_URL__WEIXIN_RELEASE?: string
  /** 兼容旧环境变量的服务端根地址 */
  readonly VITE_SERVER_BASEURL?: string
  /** H5 是否启用开发代理 */
  readonly VITE_APP_PROXY_ENABLE: 'true' | 'false'
  /** H5 开发代理前缀 */
  readonly VITE_APP_PROXY_PREFIX: string
  /** 生产构建是否移除调试输出 */
  readonly VITE_DELETE_CONSOLE: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __VITE_APP_PROXY__: 'true' | 'false'
