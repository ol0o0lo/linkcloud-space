import type { PlatformVisualEffectsAdapter, VisualEffectsMode } from '../contracts/visual-effects'

export function resolveH5VisualEffectsMode(supportsBackdropFilter: boolean, prefersReducedTransparency: boolean): VisualEffectsMode {
  return supportsBackdropFilter && !prefersReducedTransparency ? 'full' : 'reduced'
}

export const h5VisualEffectsAdapter: PlatformVisualEffectsAdapter = {
  async getMode() {
    const supportsBackdropFilter = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'))
    const prefersReducedTransparency = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-transparency: reduce)').matches

    return resolveH5VisualEffectsMode(supportsBackdropFilter, prefersReducedTransparency)
  },
}
