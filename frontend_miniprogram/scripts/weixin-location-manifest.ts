import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

type JsonObject = Record<string, unknown>

export const WEIXIN_LOCATION_MANIFEST = {
  permission: {
    'scope.userLocation': {
      desc: '用于地图找房定位当前位置，并展示附近可租房源',
    },
  },
  requiredPrivateInfos: ['getLocation', 'chooseLocation'],
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function mergeWeixinLocationManifest(manifest: JsonObject): JsonObject {
  const existingPermission = isJsonObject(manifest.permission) ? manifest.permission : {}
  const existingPrivateInfos = Array.isArray(manifest.requiredPrivateInfos)
    ? manifest.requiredPrivateInfos.filter((item): item is string => typeof item === 'string')
    : []

  return {
    ...manifest,
    permission: {
      ...existingPermission,
      ...WEIXIN_LOCATION_MANIFEST.permission,
    },
    requiredPrivateInfos: Array.from(new Set([...existingPrivateInfos, ...WEIXIN_LOCATION_MANIFEST.requiredPrivateInfos])),
  }
}

export function ensureWeixinLocationManifest(): Plugin {
  let outputDir = ''

  return {
    name: 'ensure-weixin-location-manifest',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outputDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        if (process.env.UNI_PLATFORM !== 'mp-weixin')
          return

        const appJsonPath = path.join(outputDir, 'app.json')
        if (!fs.existsSync(appJsonPath))
          throw new Error(`微信小程序构建产物不存在：${appJsonPath}`)

        const manifest = JSON.parse(fs.readFileSync(appJsonPath, 'utf8')) as JsonObject
        const mergedManifest = mergeWeixinLocationManifest(manifest)
        fs.writeFileSync(appJsonPath, `${JSON.stringify(mergedManifest, null, 2)}\n`)
      },
    },
  }
}
