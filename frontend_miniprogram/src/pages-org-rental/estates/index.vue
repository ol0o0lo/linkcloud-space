<script setup lang="ts">
import type { EstateDetailOut } from '@/pages-org-rental/api/organization-rental'
import { computed, ref } from 'vue'
import EstateCard from '@/pages-org-rental/estates/components/EstateCard.vue'
import { listOrganizationEstates } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationEstateFormRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '小区管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const hasSearch = computed(() => Boolean(keyword.value.trim()))
const list = usePagedPage<EstateDetailOut>({
  pageSize: 15,
  loader: ({ page, pageSize }) => listOrganizationEstates(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined }),
})

function openForm(id?: number) {
  uni.navigateTo({ url: getOrganizationEstateFormRoute(id) })
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
      <AppCustomNavigation title="小区管理" back scroll-mode="sticky" />
    </template>
    <AppListToolbar
      v-model:keyword="keyword"
      search-placeholder="搜索小区名称"
      action-text="新增小区"
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
        loading-text="正在加载小区…"
        :empty-text="hasSearch ? '没有找到相关小区' : '当前组织还没有小区'"
        :empty-description="hasSearch ? '试试清空搜索内容后重新查看。' : '先建立小区档案，后续可关联楼栋和房源。'"
        empty-icon="no-result"
        :empty-action-text="hasSearch ? '清除搜索' : '新增小区'"
        finished-text="没有更多小区了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <EstateCard :estate="item" @click="openForm(item.id)" />
        </template>
      </AppPagedList>
    </view>
  </AppPage>
</template>
