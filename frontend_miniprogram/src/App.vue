<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { getCurrentInstance, onMounted, onUnmounted } from 'vue'
import { navigateToInterceptor } from '@/router/interceptor'
import { tabbarStore } from '@/tabbar/store'
import { permission } from '@/router/permission'
import { flushAnalyticsEvents } from '@/infra/analytics/client'
import { useAppContextStore } from '@/store/app-context-v2'

const { proxy } = (getCurrentInstance() || {}) as any
const router = proxy?.$router

router && permission.install(router)

const appContextStore = useAppContextStore()

onLaunch(() => {
  void appContextStore.bootstrap()
})
onShow((options) => {
  void (async () => {
    await appContextStore.bootstrap()
    if (appContextStore.startupState === 'recoverable-error' || appContextStore.startupState === 'fatal-error') {
      if (options?.path !== 'pages/error/startup')
        uni.reLaunch({ url: '/pages/error/startup' })
      return
    }
    navigateToInterceptor.invoke({
      url: options?.path ? `/${options.path}` : '/pages/index/index',
      query: options?.query,
    })
  })()
})
onHide(() => {
  console.log('App Hide')
  void flushAnalyticsEvents()
})

// #ifdef H5
function syncTabbarWhenPageVisible() {
  if (document.visibilityState === 'visible') {
    tabbarStore.syncCurrentPathByCurrentPageAsync()
  }
  else {
    void flushAnalyticsEvents()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', syncTabbarWhenPageVisible)
  window.addEventListener('pageshow', syncTabbarWhenPageVisible)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', syncTabbarWhenPageVisible)
  window.removeEventListener('pageshow', syncTabbarWhenPageVisible)
})
// #endif
</script>

<style lang="scss">

</style>
