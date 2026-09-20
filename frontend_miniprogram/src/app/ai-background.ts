import type { InjectionKey } from 'vue'

export const APP_AI_BACKGROUND_CYCLE_MS = 36_000

export interface AppAiBackgroundContext {
  acquire: (source: object) => void
  release: (source: object) => void
}

export const appAiBackgroundContextKey: InjectionKey<AppAiBackgroundContext> = Symbol('app-ai-background-context')
