<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getDefaultRouteForMode } from '@/modules/registry'
import AppStateCard from '@/components/app/AppStateCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '页面状态', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const reason = ref('')
const requiredMode = ref('')
const presentation = computed(() => {
  if (reason.value === 'identity') {
    const identity = requiredMode.value === 'landlord' ? '房东' : requiredMode.value === 'organization' ? '经纪人' : '租客'
    return { title: `此功能需要${identity}身份`, description: `当前账号暂无可用的${identity}身份，请确认账号或身份关联。` }
  }
  if (reason.value === 'context')
    return { title: '该身份当前不可用', description: '当前账号无法使用目标工作空间或房东身份，请确认账号及关联关系。' }
  return { title: '暂无访问权限', description: '当前账号在目标工作空间中没有此功能所需的权限，请联系空间管理员。' }
})
onLoad((options) => {
  reason.value = String(options?.reason || '')
  requiredMode.value = String(options?.mode || '')
})
function goHome() {
  uni.reLaunch({ url: getDefaultRouteForMode(appContextStore.mode) })
}
</script>

<template>
  <AppPage variant="plain" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="页面状态" back scroll-mode="sticky" />
    </template>
    <view class="error-page box-border bg-surface-page px-5 py-6 min-h-inherit">
      <view class="error-heading mb-3.5 flex flex-col gap-1">
        <strong>{{ presentation.title }}</strong><text>{{ presentation.description }}</text>
      </view><AppStateCard tone="warning" icon="i-carbon-locked" :title="reason ? '身份不可用' : '访问受限'" :description="presentation.description">
        <template #action>
          <wd-button size="small" variant="plain" @click="goHome">
            返回当前模式首页
          </wd-button>
        </template>
      </AppStateCard>
    </view>
  </AppPage>
</template>

<style scoped>
.error-heading strong {
  @apply text-content-primary text-size-base;
}
.error-heading text {
  @apply text-content-muted text-size-2xs;
}
</style>
