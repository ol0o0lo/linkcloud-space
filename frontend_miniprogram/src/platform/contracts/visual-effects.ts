export type VisualEffectsMode = 'full' | 'reduced'

export interface PlatformVisualEffectsAdapter {
  getMode: () => Promise<VisualEffectsMode>
}
