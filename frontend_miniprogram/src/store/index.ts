import { createPinia, setActivePinia } from 'pinia'

const store = createPinia()
// 立即激活 Pinia 实例, 这样即使在 app.use(store)之前调用 store 也能正常工作 （解决APP端白屏问题）
setActivePinia(store)

export default store

export * from './app-context-v2'
export * from './runtime'
export * from './session'
export * from './workspace'
