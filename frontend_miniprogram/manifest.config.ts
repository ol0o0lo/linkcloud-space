import path from 'node:path'
import process from 'node:process'
import { defineManifestConfig } from '@uni-helper/vite-plugin-uni-manifest'
import { loadEnv } from 'vite'

function getMode(): string {
  const args = process.argv.slice(2)
  const modeFlagIndex = args.findIndex(arg => arg === '--mode')
  if (modeFlagIndex !== -1)
    return args[modeFlagIndex + 1]
  return args[0] === 'build' ? 'production' : 'development'
}

const env = loadEnv(getMode(), path.resolve(process.cwd(), 'env'))

export default defineManifestConfig({
  'name': env.VITE_APP_TITLE,
  'description': '链云空间微信小程序与 H5 客户端',
  'versionName': '1.0.0',
  'versionCode': '100',
  'transformPx': false,
  'locale': env.VITE_FALLBACK_LOCALE || 'zh-Hans',
  'h5': {
    router: {
      base: env.VITE_APP_PUBLIC_BASE,
    },
  },
  'mp-weixin': {
    appid: env.VITE_WX_APPID,
    setting: {
      urlCheck: false,
      es6: true,
      minified: true,
    },
    optimization: {
      subPackages: true,
    },
    mergeVirtualHostAttributes: true,
    usingComponents: true,
  },
  'uniStatistics': {
    enable: false,
  },
  'vueVersion': '3',
})
