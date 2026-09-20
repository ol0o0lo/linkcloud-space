import type { Plugin } from 'vite'
import fs from 'node:fs'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import Uni from '@uni-helper/plugin-uni'
import { isMpWeixin } from '@uni-helper/uni-env'
import UniComponents from '@uni-helper/vite-plugin-uni-components'
import UniLayouts from '@uni-helper/vite-plugin-uni-layouts'
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
import UniPages from '@uni-helper/vite-plugin-uni-pages'
import UniPlatform from '@uni-helper/vite-plugin-uni-platform'
import UniOptimization from '@uni-ku/bundle-optimizer'
import UniKuRoot from '@uni-ku/root'
import dayjs from 'dayjs'
import { visualizer } from 'rollup-plugin-visualizer'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig, loadEnv } from 'vite'
import openDevTools from './scripts/open-dev-tools'
import { getSubpackageSourceRootsForBuild } from './src/modules/subpackages'
import vitePluginEruda from './scripts/vite-plugin-eruda'
import { ensureWeixinLocationManifest } from './scripts/weixin-location-manifest'
import { WotResolver } from './wot-ui-resolver'

const unsupportedManifestPlatforms = ['app-plus', 'app-harmony', 'mp-harmony', 'quickapp', 'mp-alipay', 'mp-baidu', 'mp-toutiao'] as const

function isPrivateIpv4(address: string): boolean {
  return /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address)
}

function getLanIpv4(): string | undefined {
  const interfaces = networkInterfaces()
  const preferredNames = ['en0', 'en1', 'wlan0', 'eth0']
  const names = [...preferredNames, ...Object.keys(interfaces).filter(name => !preferredNames.includes(name))]

  for (const name of names) {
    const address = interfaces[name]?.find(item => item.family === 'IPv4' && !item.internal && isPrivateIpv4(item.address))
    if (address)
      return address.address
  }
}

function fixUniWeixinShadowPreload(): Plugin {
  const shadowImageUrl = 'https://cdn.dcloud.net.cn/img/shadow-grey.png'

  return {
    name: 'fix-uni-weixin-shadow-preload',
    enforce: 'post',
    generateBundle(_, bundle) {
      if (process.env.UNI_PLATFORM !== 'mp-weixin')
        return

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk' || !output.code.includes('wx.preloadAssets') || !output.code.includes('/img/shadow-grey.png'))
          continue

        output.code = output.code.replace(
          /src:\s*[$A-Z_a-z][$\w]*\s*\+\s*(["'])\/(?:[^"'\\]*\/)?img\/shadow-grey\.png\1/g,
          `src: ${JSON.stringify(shadowImageUrl)}`,
        )
      }
    },
  }
}

function restrictManifestPlatforms(): Plugin {
  const manifestPath = path.resolve(process.cwd(), 'src/manifest.json')

  function cleanGeneratedManifest() {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    for (const platform of unsupportedManifestPlatforms)
      delete manifest[platform]
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }

  return {
    name: 'restrict-manifest-platforms',
    enforce: 'pre',
    configResolved() {
      cleanGeneratedManifest()
    },
  }
}

export default defineConfig(({ mode }) => {
  const { UNI_PLATFORM, SKIP_OPEN_DEVTOOLS } = process.env
  const envDir = path.resolve(process.cwd(), 'env')
  const env = loadEnv(mode, envDir)
  const localEnv = loadEnv(mode, envDir, '')
  if (mode === 'development' && UNI_PLATFORM === 'mp-weixin' && env.VITE_API_BASE_URL__WEIXIN_DEVELOP === 'auto') {
    const lanIp = getLanIpv4()
    if (!lanIp)
      throw new Error('未检测到局域网 IPv4，请手动配置 VITE_API_BASE_URL__WEIXIN_DEVELOP')
    const lanApiUrl = `http://${lanIp}:18000`
    env.VITE_API_BASE_URL__WEIXIN_DEVELOP = lanApiUrl
    process.env.VITE_API_BASE_URL__WEIXIN_DEVELOP = lanApiUrl
    console.info(`微信小程序开发接口：${lanApiUrl}`)
  }
  const {
    VITE_APP_PORT = '9000',
    VITE_SERVER_BASEURL,
    VITE_APP_TITLE,
    VITE_DELETE_CONSOLE,
    VITE_APP_PUBLIC_BASE,
    VITE_APP_PROXY_ENABLE,
    VITE_APP_PROXY_PREFIX,
  } = env
  const { WECHAT_DEVTOOLS_CLI_PATH } = localEnv
  const subpackageSourceRoots = getSubpackageSourceRootsForBuild(mode === 'development' ? 'development' : 'production')

  return {
    envDir: './env',
    base: VITE_APP_PUBLIC_BASE,
    plugins: [
      UniLayouts(),
      UniPlatform(),
      UniManifest(),
      restrictManifestPlatforms(),
      UniComponents({
        extensions: ['vue'],
        deep: true,
        directoryAsNamespace: false,
        dts: false,
        resolvers: [WotResolver()],
      }),
      UniPages({
        exclude: ['**/components/**/**.*', '**/sections/**/**.*'],
        subPackages: subpackageSourceRoots,
        dts: 'src/types/uni-pages.d.ts',
      }),
      UniOptimization({
        enable: isMpWeixin,
        dts: { base: 'src/types' },
        logger: false,
      }),
      UniKuRoot({
        excludePages: ['**/components/**/**.*', '**/sections/**/**.*'],
      }),
      Uni(),
      fixUniWeixinShadowPreload(),
      ensureWeixinLocationManifest(),
      {
        name: 'fix-vite-plugin-vue',
        configResolved(config) {
          const plugin = config.plugins.find(item => item.name === 'vite:vue')
          if (plugin?.api?.options)
            plugin.api.options.devToolsEnabled = false
        },
      },
      UnoCSS(),
      AutoImport({
        imports: ['vue', 'uni-app'],
        dts: 'src/types/auto-import.d.ts',
        dirs: ['src/hooks'],
        vueTemplate: true,
      }),
      UNI_PLATFORM === 'h5' && {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html
            .replace('%BUILD_TIME%', dayjs().format('YYYY-MM-DD HH:mm:ss'))
            .replace('%VITE_APP_TITLE%', VITE_APP_TITLE)
        },
      },
      UNI_PLATFORM === 'h5'
      && mode === 'production'
      && visualizer({
        filename: './node_modules/.cache/visualizer/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      vitePluginEruda({
        open: UNI_PLATFORM === 'h5' && mode === 'development',
      }),
      mode === 'development' && SKIP_OPEN_DEVTOOLS !== 'true' && openDevTools({
        mode,
        wechatDevtoolsCliPath: WECHAT_DEVTOOLS_CLI_PATH,
      }),
    ],
    define: {
      __VITE_APP_PROXY__: JSON.stringify(VITE_APP_PROXY_ENABLE),
    },
    resolve: {
      alias: {
        '@': path.join(process.cwd(), './src'),
        '@img': path.join(process.cwd(), './src/static/images'),
      },
    },
    server: {
      host: '0.0.0.0',
      hmr: true,
      port: Number.parseInt(VITE_APP_PORT, 10),
      proxy: VITE_APP_PROXY_ENABLE === 'true'
        ? {
            [VITE_APP_PROXY_PREFIX]: {
              target: VITE_SERVER_BASEURL,
              changeOrigin: true,
              rewrite: requestPath => requestPath.replace(new RegExp(`^${VITE_APP_PROXY_PREFIX}`), ''),
            },
          }
        : undefined,
    },
    esbuild: {
      drop: VITE_DELETE_CONSOLE === 'true' ? ['console', 'debugger'] : [],
    },
    build: {
      sourcemap: false,
      target: 'es6',
      minify: mode === 'development' ? false : 'esbuild',
    },
  }
})
