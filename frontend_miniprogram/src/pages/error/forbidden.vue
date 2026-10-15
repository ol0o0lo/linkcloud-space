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
    const identity = requiredMode.value === 'landlord' ? '房东' : requiredMode.value === 'organization' ? '中介' : '租客'
    return { title: `此功能需要${identity}身份`, description: `当前账号暂无可用的${identity}身份，请确认账号或身份关联。` }
  }
  if (reason.value === 'context')
    return { title: '该身份当前不可用', description: '当前账号无法使用目标组织或房东身份，请确认账号及关联关系。' }
  return { title: '你没有访问权限', description: '当前账号在目标组织中没有此功能所需的权限，请联系组织管理员。' }
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
    <view class="error-page">
      <view class="error-heading">
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

<style scoped lang="scss">
.error-page {
  min-height: inherit;
  padding: 48rpx 40rpx;
  box-sizing: border-box;
  background: var(--app-bg-page);
}
.error-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 28rpx;
}
.error-heading strong {
  color: var(--app-text-primary);
  font-size: 32rpx;
}
.error-heading text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
</style>
