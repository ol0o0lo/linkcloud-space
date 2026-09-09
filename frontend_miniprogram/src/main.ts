import { createSSRApp } from 'vue'
import App from './App.vue'
import { routeInterceptor } from './router/interceptor'

import { configureHttpRuntime } from './infra/http/runtime'
import store, { useAppContextStore, useRuntimeStore, useSessionStore } from './store'
import '@/style/index.scss'
import 'virtual:uno.css'
import i18n from './locale/index'

export function createApp() {
  const app = createSSRApp(App)
  app.use(store)
  configureHttpRuntime({
    getSessionToken: () => useSessionStore().sessionToken,
    onSessionInvalidated: () => {
      useSessionStore().clearSession()
      useAppContextStore().resetToVisitor()
    },
    recoverSession: () => useRuntimeStore().recoverSession(),
  })
  app.use(routeInterceptor)
  app.use(i18n)

  return {
    app,
  }
}
