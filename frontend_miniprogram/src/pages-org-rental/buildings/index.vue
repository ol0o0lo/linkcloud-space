<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import type { BuildingInventoryOut, BuildingMapUnlocatedOut } from '@/pages-org-rental/api/organization-rental'
import { computed, ref } from 'vue'
import BuildingCard from '@/pages-org-rental/buildings/components/BuildingCard.vue'
import { listOrganizationBuildings, listOrganizationUnlocatedBuildings } from '@/pages-org-rental/api/organization-rental'
import { getOrganizationBuildingFormRoute } from '@/modules/routes'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import RentalPageHeading from '../components/RentalPageHeading.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '楼栋管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const unlocatedOnly = ref(false)
onLoad((options) => {
  unlocatedOnly.value = options?.unlocated === '1'
})
const hasSearch = computed(() => Boolean(keyword.value.trim()))
const list = usePagedPage<BuildingInventoryOut | BuildingMapUnlocatedOut>({
  pageSize: 15,
  loader: ({ page, pageSize }) => unlocatedOnly.value
    ? listOrganizationUnlocatedBuildings(appContextStore.organizationSlug, page, pageSize, keyword.value.trim() || undefined)
    : listOrganizationBuildings(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined }),
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
  <AppPage class="rental-page" variant="list">
    <template #navigation>
      <AppCustomNavigation :title="unlocatedOnly ? '待定位楼栋' : '楼栋管理'" back scroll-mode="sticky" />
    </template>
    <RentalPageHeading :title="unlocatedOnly ? '待定位楼栋' : '楼栋档案'" description="维护楼栋位置与房源库存" :total="list.loaded.value ? list.total.value : null" unit="栋">
      <wd-button size="small" @click="openForm()">
        新增楼栋
      </wd-button>
    </RentalPageHeading>
    <view class="rental-search">
      <AppListToolbar v-model:keyword="keyword" search-placeholder="搜索楼栋名称或地址" @search="list.refresh" @clear="list.refresh" />
    </view>
    <view class="rental-results">
      <strong>楼栋档案</strong><text>点击档案维护资料</text>
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="list.items.value"
        :loading="list.loading.value"
        :refreshing="list.refreshing.value"
        :loading-more="list.loadingMore.value"
        :finished="list.finished.value"
        :error="list.error.value"
        loading-text="正在加载楼栋…"
        :empty-text="hasSearch ? '没有找到相关楼栋' : unlocatedOnly ? '没有待定位楼栋' : '当前工作空间还没有楼栋'"
        :empty-description="hasSearch ? '试试清空搜索内容后重新查看。' : unlocatedOnly ? '楼栋位置已补齐，可返回地图查看。' : '新增楼栋后，可以继续在楼栋下维护房源。'"
        empty-icon="no-result"
        :empty-action-text="hasSearch ? '清除搜索' : '新增楼栋'"
        finished-text="没有更多楼栋了"
        @retry="list.refresh"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <BuildingCard v-if="'floors' in item" :building="item" @click="openForm(item.id)" />
          <AppRecordCard v-else clickable @click="openForm(item.id)">
            <template #title>
              {{ item.name }}
            </template>
            <template #description>
              {{ item.address || '地址未登记' }}
            </template>
            <template #footer>
              待定位 · 点击维护位置
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
@use '../components/management';
</style>
