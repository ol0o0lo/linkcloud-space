<script setup lang="ts">
import type { BuildingInventoryOut } from '@/pages-org-rental/api/organization-rental'
import { computed, ref } from 'vue'
import BuildingCard from '@/pages-org-rental/buildings/components/BuildingCard.vue'
import { listOrganizationBuildings } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationBuildingFormRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '楼栋管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const hasSearch = computed(() => Boolean(keyword.value.trim()))
const list = usePagedPage<BuildingInventoryOut>({
  pageSize: 15,
  loader: ({ page, pageSize }) => listOrganizationBuildings(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined }),
})

function openForm(id?: number) {
  uni.navigateTo({ url: getOrganizationBuildingFormRoute(id) })
}

function handleEmptyAction() {
  if (!hasSearch.value) {
    openForm()
    return
  }
  keyword.value = ''
  void list.refresh()
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="楼栋管理" back scroll-mode="sticky" />
    </template>
    <AppListToolbar
      v-model:keyword="keyword"
      search-placeholder="搜索楼栋或地址"
      action-text="新增楼栋"
      @search="list.refresh"
      @clear="list.refresh"
      @action="openForm()"
    />
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载楼栋…"
        :empty-text="hasSearch ? '没有找到相关楼栋' : '当前组织还没有楼栋'"
        :empty-description="hasSearch ? '试试清空搜索内容后重新查看。' : '新增楼栋后，可以继续在楼栋下维护房源。'"
        empty-icon="no-result"
        :empty-action-text="hasSearch ? '清除搜索' : '新增楼栋'"
        finished-text="没有更多楼栋了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <BuildingCard :building="item" @click="openForm(item.id)" />
        </template>
      </AppPagedList>
    </view>
  </AppPage>
</template>
