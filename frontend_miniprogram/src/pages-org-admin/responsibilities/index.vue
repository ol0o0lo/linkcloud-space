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

definePage({ style: { navigationBarTitleText: '房源职责', navigationStyle: 'custom', enablePullDownRefresh: true } })

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
      <AppCustomNavigation title="房源职责" back scroll-mode="sticky" />
    </template>
    <view class="responsibility-tools">
      <view class="responsibility-search">
        <wd-search v-model="keyword" variant="filled" placeholder="搜索员工姓名、账号或邮箱" placeholder-left hide-cancel @search="refreshList" @clear="refreshList" />
      </view>
    </view>
    <view class="responsibility-heading">
      <text>{{ memberId ? '当前员工' : searchKeyword ? '搜索结果' : '员工分工' }}<text v-if="responsibilityPage.loaded.value" class="responsibility-total">{{ responsibilityPage.total.value }} 人</text></text>
      <wd-button v-if="memberId" size="small" variant="text" @click="showAllMembers">
        查看全部
      </wd-button>
      <text v-else class="responsibility-hint">点击员工即可配置</text>
    </view>
    <view class="member-list">
      <AppPagedList
        :items="responsibilityPage.items.value"
        item-key="member_id"
        layout="cell"
        :loading="responsibilityPage.loading.value"
        :refreshing="responsibilityPage.refreshing.value"
        :loading-more="responsibilityPage.loadingMore.value"
        :finished="responsibilityPage.finished.value"
        :error="responsibilityPage.error.value"
        loading-text="正在加载房源职责…"
        :empty-text="searchKeyword ? '没有找到相关员工' : '当前没有可配置职责的员工'"
        :empty-description="searchKeyword ? '试试其他姓名、账号或邮箱。' : ''"
        finished-text="没有更多成员了"
        @retry="refreshList"
      >
        <template #item="{ item, index }">
          <wd-cell is-link center :border="index > 0" @click="openEditor(item)">
            <view class="member-row">
              <view class="member-avatar" :class="{ 'member-avatar--unassigned': !hasScope(item) }">
                {{ formatOrganizationAdminUser(item.user).slice(0, 1) }}
              </view>
              <view class="member-main">
                <view class="member-heading">
                  <text class="member-name">{{ formatOrganizationAdminUser(item.user) }}</text>
                  <text v-if="hasScope(item)" class="member-count">{{ item.responsible_house_count ? `${item.responsible_house_count} 套房源` : '暂无负责房源' }}</text>
                </view>
                <view class="member-summary" :class="{ 'member-summary--empty': !hasScope(item) }">
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
  padding: 12px;
  overflow: hidden;
  border-radius: 14px;
  background: var(--app-bg-card);
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
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 12px;
  line-height: 18px;
}
.responsibility-total {
  margin-left: 8px;
  color: var(--app-text-muted);
}
.responsibility-hint {
  color: var(--app-text-muted);
}
.member-list {
  --wot-cell-padding: 16px;
  --wot-cell-border-color: var(--app-divider-color);
  --wot-cell-border-margin-horizontal: 16px;
  --wot-cell-arrow-size: 16px;
  --wot-cell-arrow-margin-left: 12px;

  overflow: hidden;
  border-radius: 14px;
  background: var(--app-bg-card);
}
.member-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  text-align: left;
}
.member-avatar {
  display: flex;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--app-bg-brand-soft);
  color: var(--app-color-brand);
  font-size: 14px;
  font-weight: 600;
}
.member-avatar--unassigned {
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
}
.member-main {
  min-width: 0;
  flex: 1;
}
.member-heading {
  display: flex;
  min-height: 24px;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}
.member-name {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-count {
  flex-shrink: 0;
  color: var(--app-color-brand);
  font-size: 12px;
  line-height: 18px;
}
.member-summary {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 4px;
  color: var(--app-text-secondary);
  font-size: 13px;
  line-height: 20px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}
.member-summary--empty {
  color: var(--app-text-muted);
}
</style>
