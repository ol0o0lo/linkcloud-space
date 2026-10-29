<script setup lang="ts">
import type { PropertyResponsibilityMemberOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { formatOrganizationAdminUser } from '@/domain/organization-admin'
import { listOrganizationResponsibilities } from '@/features/organization-admin/service'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'
import { APP_ROUTES } from '@/modules/routes'

definePage({ style: { navigationBarTitleText: '房源分工', navigationStyle: 'custom', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const keyword = ref('')
const searchKeyword = ref('')
const memberId = ref<number>()
onLoad((options) => {
  const id = Number(options?.memberId)
  memberId.value = Number.isInteger(id) && id > 0 ? id : undefined
})

const responsibilityPage = usePagedPage<PropertyResponsibilityMemberOut>({
  loader: ({ page, pageSize }) => listOrganizationResponsibilities(appContextStore.organizationSlug, page, pageSize, {
    keyword: searchKeyword.value || undefined,
    member_id: memberId.value,
  }),
  pageSize: 15,
  keyOf: item => item.member_id,
})

async function refreshList() {
  searchKeyword.value = keyword.value.trim()
  await responsibilityPage.refresh()
}

function showAllMembers() {
  memberId.value = undefined
  void refreshList()
}

function hasScope(item: PropertyResponsibilityMemberOut) {
  return Boolean(item.landlords.length || item.buildings.length || item.estates.length)
}

function scopeSummary(item: PropertyResponsibilityMemberOut) {
  const names = [
    item.landlords.length ? `房东 ${item.landlords[0].name}${item.landlords.length > 1 ? `等 ${item.landlords.length} 位` : ''}` : '',
    item.buildings.length ? `${item.buildings[0].estate?.display_name || item.buildings[0].estate?.name || '独立楼栋'} ${item.buildings[0].name}${item.buildings.length > 1 ? `等 ${item.buildings.length} 栋` : ''}` : '',
    item.estates.length ? `小区 ${item.estates[0].display_name || item.estates[0].name}${item.estates.length > 1 ? `等 ${item.estates.length} 个` : ''}` : '',
  ]
  return names.filter(Boolean).join(' · ')
}

function openEditor(item: PropertyResponsibilityMemberOut) {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminResponsibilityEdit}?id=${item.member_id}` })
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="房源分工" back scroll-mode="sticky" />
    </template>
    <view class="responsibility-tools overflow-hidden rounded-3.5 p-3">
      <view class="responsibility-search">
        <wd-search v-model="keyword" variant="filled" placeholder="搜索员工姓名、账号或邮箱" placeholder-left hide-cancel @search="refreshList" @clear="refreshList" />
      </view>
    </view>
    <view class="responsibility-heading mt-1 min-h-10 flex items-center justify-between gap-3 text-size-xs leading-4.5">
      <text>{{ memberId ? '当前员工' : searchKeyword ? '搜索结果' : '员工分工' }}<text v-if="responsibilityPage.loaded.value" class="responsibility-total ml-2">{{ responsibilityPage.total.value }} 人</text></text>
      <wd-button v-if="memberId" size="small" variant="text" @click="showAllMembers">
        查看全部
      </wd-button>
      <text v-else class="responsibility-hint">点击员工即可配置</text>
    </view>
    <view class="member-list overflow-hidden rounded-3.5">
      <AppPagedList
        :items="responsibilityPage.items.value"
        item-key="member_id"
        layout="cell"
        :loading="responsibilityPage.loading.value"
        :refreshing="responsibilityPage.refreshing.value"
        :loading-more="responsibilityPage.loadingMore.value"
        :finished="responsibilityPage.finished.value"
        :error="responsibilityPage.error.value"
        loading-text="正在加载房源分工…"
        :empty-text="searchKeyword ? '没有找到相关员工' : '当前没有可配置职责的员工'"
        :empty-description="searchKeyword ? '试试其他姓名、账号或邮箱。' : ''"
        finished-text="没有更多成员了"
        @retry="refreshList"
      >
        <template #item="{ item, index }">
          <wd-cell is-link center :border="index > 0" @click="openEditor(item)">
            <view class="member-row flex items-start gap-3 text-left">
              <view class="member-avatar h-9 w-9 flex flex-none basis-9 items-center justify-center rounded-2.5 text-size-sm font-semibold" :class="{ 'member-avatar--unassigned': !hasScope(item) }">
                {{ formatOrganizationAdminUser(item.user).slice(0, 1) }}
              </view>
              <view class="member-main min-w-0 flex-1">
                <view class="member-heading min-h-6 flex items-center justify-between gap-2">
                  <text class="member-name overflow-hidden text-ellipsis whitespace-nowrap text-size-sm font-semibold leading-5.5">{{ formatOrganizationAdminUser(item.user) }}</text>
                  <text v-if="hasScope(item)" class="member-count shrink-0 text-size-xs leading-4.5">{{ item.responsible_house_count ? `${item.responsible_house_count} 套房源` : '暂无负责房源' }}</text>
                </view>
                <view class="member-summary mt-1 overflow-hidden text-size-xs leading-5" :class="{ 'member-summary--empty': !hasScope(item) }">
                  {{ hasScope(item) ? scopeSummary(item) : '尚未分配，点击安排负责范围' }}
                </view>
              </view>
            </view>
          </wd-cell>
        </template>
      </AppPagedList>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.responsibility-tools {
  @apply bg-surface-card;
}
.responsibility-search {
  --wot-search-padding: 0;
  --wot-search-bg: transparent;
  --wot-search-input-radius: 10px;
  --wot-search-input-height: 40px;
  --wot-search-input-bg: var(--app-bg-page);
  --wot-search-cover-bg: var(--app-bg-page);
  --wot-search-input-font-size: 14px;
}
.responsibility-heading {
  @apply text-content-secondary;
}
.responsibility-total {
  @apply text-content-muted;
}
.responsibility-hint {
  @apply text-content-muted;
}
.member-list {
  --wot-cell-padding: 16px;
  --wot-cell-border-color: var(--app-divider-color);
  --wot-cell-border-margin-horizontal: 16px;
  --wot-cell-arrow-size: 16px;
  --wot-cell-arrow-margin-left: 12px;
  @apply bg-surface-card;
}
.member-avatar {
  @apply bg-surface-brand-soft text-app-brand;
}
.member-avatar--unassigned {
  @apply bg-surface-subtle text-content-secondary;
}
.member-name {
  @apply text-content-primary;
}
.member-count {
  @apply text-app-brand;
}
.member-summary {
  display: -webkit-box;
  @apply text-content-secondary;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}
.member-summary--empty {
  @apply text-content-muted;
}
</style>
