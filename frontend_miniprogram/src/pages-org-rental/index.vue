<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import OrganizationWorkbench from '@/features/organization-workbench/OrganizationWorkbench.vue'
import OrganizationWeather from '@/features/organization-workbench/OrganizationWeather.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '中介工作台', enablePullDownRefresh: true } })

const workbench = ref<InstanceType<typeof OrganizationWorkbench> | null>(null)
const weather = ref<InstanceType<typeof OrganizationWeather> | null>(null)

onShow(() => {
  void workbench.value?.refresh()
  void weather.value?.refresh()
})
onPullDownRefresh(async () => {
  try {
    await Promise.all([workbench.value?.refresh(), weather.value?.refresh()])
  }
  finally {
    uni.stopPullDownRefresh()
  }
})
</script>

<template>
  <AppPage>
    <template #navigation>
      <AppCustomNavigation title="中介工作台" align="start" back scroll-mode="sticky">
        <template #content>
          <OrganizationWeather ref="weather" />
        </template>
      </AppCustomNavigation>
    </template>
    <OrganizationWorkbench ref="workbench" />
  </AppPage>
</template>
