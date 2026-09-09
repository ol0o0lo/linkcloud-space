<script setup lang="ts">
import type { BuildingInventoryOut, ContactOut, EstateDetailOut, PropertyResponsibilityMemberOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import { isEmptyResponsibilitySelection } from '@/domain/organization-admin'
import {
  listAllOrganizationResponsibilityBuildings,
  listAllOrganizationResponsibilityEstates,
  listAllOrganizationResponsibilityLandlords,
  listOrganizationResponsibilities,
  replaceOrganizationResponsibility,
} from '@/features/organization-admin/service'
import AppListState from '@/shared/components/AppListState.vue'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房源职责', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const keyword = ref('')
const editorVisible = ref(false)
const editingMember = ref<PropertyResponsibilityMemberOut | null>(null)
const landlords = ref<ContactOut[]>([])
const buildings = ref<BuildingInventoryOut[]>([])
const estates = ref<EstateDetailOut[]>([])
const landlordIds = ref<number[]>([])
const buildingIds = ref<number[]>([])
const estateIds = ref<number[]>([])
const saving = ref(false)

const responsibilityQuery = usePagedQuery<PropertyResponsibilityMemberOut>(({ page, pageSize }) => listOrganizationResponsibilities(appContextStore.organizationSlug, page, pageSize, {
  keyword: keyword.value.trim() || undefined,
}), { pageSize: 15 })

async function refreshList() {
  try {
    await responsibilityQuery.refresh()
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await responsibilityQuery.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

function toggleId(collection: number[], id: number) {
  const index = collection.indexOf(id)
  if (index >= 0)
    collection.splice(index, 1)
  else
    collection.push(id)
}

async function openEditor(item: PropertyResponsibilityMemberOut) {
  editingMember.value = item
  landlordIds.value = item.landlords.map(value => value.id)
  buildingIds.value = item.buildings.map(value => value.id)
  estateIds.value = item.estates.map(value => value.id)
  try {
    const [landlordItems, buildingItems, estateItems] = await Promise.all([
      listAllOrganizationResponsibilityLandlords(appContextStore.organizationSlug),
      listAllOrganizationResponsibilityBuildings(appContextStore.organizationSlug),
      listAllOrganizationResponsibilityEstates(appContextStore.organizationSlug),
    ])
    landlords.value = landlordItems.filter(value => value.roles.includes('landlord'))
    buildings.value = buildingItems
    estates.value = estateItems
    editorVisible.value = true
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '职责候选加载失败') }
}

async function saveResponsibility() {
  if (saving.value || !editingMember.value)
    return
  const payload = { landlord_ids: landlordIds.value, building_ids: buildingIds.value, estate_ids: estateIds.value }
  const empty = isEmptyResponsibilitySelection(payload)
  const confirmation = await uni.showModal({
    title: empty ? '清空房源职责' : '保存房源职责',
    content: empty ? '保存后该成员将不再负责任何房东、楼栋或小区。' : '新的职责范围会立即用于房源权限判断。',
    confirmText: empty ? '确认清空' : '确认保存',
  })
  if (!confirmation.confirm)
    return
  saving.value = true
  try {
    await replaceOrganizationResponsibility(appContextStore.organizationSlug, editingMember.value.member_id, payload)
    toast.success('房源职责已保存')
    editorVisible.value = false
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '房源职责保存失败') }
  finally { saving.value = false }
}

onShow(() => void refreshList())
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <wd-search v-model="keyword" placeholder="搜索员工姓名、账号或职位" hide-cancel @search="refreshList" @clear="refreshList" />
    <view v-if="responsibilityQuery.items.value.length" class="card-list">
      <view v-for="item in responsibilityQuery.items.value" :key="item.member_id" class="record-card" @click="openEditor(item)">
        <view class="record-main">
          <strong>{{ ((item.user.first_name || '') + (item.user.last_name || '')) || item.user.username }}</strong><text>{{ item.landlords.length }} 位房东 · {{ item.buildings.length }} 栋楼 · {{ item.estates.length }} 个小区</text>
        </view>
        <view class="count">
          {{ item.responsible_house_count }} 套
        </view>
      </view>
    </view>
    <AppListState :loading="responsibilityQuery.loading.value" :has-items="Boolean(responsibilityQuery.items.value.length)" :finished="responsibilityQuery.finished.value" :error-message="responsibilityQuery.error.value?.message || ''" loading-text="正在加载房源职责…" empty-text="当前没有可配置职责的成员" finished-text="没有更多成员了" @retry="refreshList" />
    <wd-popup v-model="editorVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx; max-height: 84vh; overflow: auto;">
      <view class="popup-title">
        配置房源职责
      </view>
      <view class="group-title">
        负责房东
      </view>
      <view class="option-grid">
        <view v-for="item in landlords" :key="item.id" class="option" :class="[{ selected: landlordIds.includes(item.id) }]" @click="toggleId(landlordIds, item.id)">
          {{ item.name }}
        </view>
      </view>
      <view class="group-title">
        负责楼栋
      </view>
      <view class="option-grid">
        <view v-for="item in buildings" :key="item.id" class="option" :class="[{ selected: buildingIds.includes(item.id) }]" @click="toggleId(buildingIds, item.id)">
          {{ item.estate?.display_name || item.estate?.name || '' }} {{ item.name }}
        </view>
      </view>
      <view class="group-title">
        负责小区
      </view>
      <view class="option-grid">
        <view v-for="item in estates" :key="item.id" class="option" :class="[{ selected: estateIds.includes(item.id) }]" @click="toggleId(estateIds, item.id)">
          {{ item.display_name || item.name }}
        </view>
      </view>
      <wd-button block :loading="saving" :disabled="saving" @click="saveResponsibility">
        保存职责范围
      </wd-button>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 20rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}
.record-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.record-main {
  min-width: 0;
  flex: 1;
}
.record-main strong,
.record-main text {
  display: block;
}
.record-main strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.record-main text {
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.count {
  color: var(--app-color-primary);
  font-size: 25rpx;
  font-weight: 650;
}
.popup-title {
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.group-title {
  margin: 24rpx 0 12rpx;
  color: var(--app-text-primary);
  font-size: 25rpx;
  font-weight: 650;
}
.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.option {
  padding: 13rpx 18rpx;
  border: 1px solid var(--app-border-color);
  border-radius: 999rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
.option.selected {
  border-color: var(--app-color-primary);
  color: var(--app-color-primary);
  background: var(--app-color-primary-light);
}
.option-grid + :deep(.wd-button),
.popup-title + :deep(.wd-button) {
  margin-top: 28rpx;
}
</style>
