import type { PlatformVisualEffectsAdapter, VisualEffectsMode } from '../contracts/visual-effects'

export function resolveWeixinVisualEffectsMode(modelLevel: number): VisualEffectsMode {
  return modelLevel === 3 ? 'reduced' : 'full'
}

export const weixinVisualEffectsAdapter: PlatformVisualEffectsAdapter = {
  getMode: () => new Promise((resolve) => {
    if (typeof uni.getDeviceBenchmarkInfo !== 'function') {
      resolve('full')
      return
    }

    uni.getDeviceBenchmarkInfo({
      success(result) {
        resolve(resolveWeixinVisualEffectsMode(result.modelLevel))
      },
      fail() {
        resolve('full')
      },
    })
  }),
}
