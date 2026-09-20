<script setup lang="ts">
import type { BuildingInventoryOut, ContactOut, EstateDetailOut, PropertyResponsibilityMemberOut } from '@/features/organization-admin/service'
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
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房源职责', navigationStyle: 'custom', enablePullDownRefresh: true } })

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

const responsibilityPage = usePagedPage<PropertyResponsibilityMemberOut>({
  loader: ({ page, pageSize }) => listOrganizationResponsibilities(appContextStore.organizationSlug, page, pageSize, {
    keyword: keyword.value.trim() || undefined,
  }),
  pageSize: 15,
  keyOf: item => item.member_id,
})

async function refreshList() {
  await responsibilityPage.refresh()
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
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="房源职责" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <AppListToolbar v-model:keyword="keyword" card search-placeholder="搜索员工姓名、账号或职位" @search="refreshList" @clear="refreshList" />
    <view class="mt-2.5">
      <AppPagedList
        :items="responsibilityPage.items.value"
        item-key="member_id"
        :loading="responsibilityPage.loading.value"
        :refreshing="responsibilityPage.refreshing.value"
        :loading-more="responsibilityPage.loadingMore.value"
        :finished="responsibilityPage.finished.value"
        :error="responsibilityPage.error.value"
        loading-text="正在加载房源职责…"
        empty-text="当前没有可配置职责的成员"
        finished-text="没有更多成员了"
        @retry="refreshList"
      >
        <template #item="{ item }">
          <AppRecordCard clickable @click="openEditor(item)">
            <template #title>
              {{ ((item.user.first_name || '') + (item.user.last_name || '')) || item.user.username }}
            </template>
            <template #status>
              <view class="text-xs text-app-brand font-semibold">
                {{ item.responsible_house_count }} 套
              </view>
            </template>
            <template #description>
              {{ item.landlords.length }} 位房东 · {{ item.buildings.length }} 栋楼 · {{ item.estates.length }} 个小区
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>
    <AppBottomSheet v-model:visible="editorVisible" title="配置房源职责" height="tall">
      <view>
        <view class="mb-1.5 mt-3 text-xs text-content-primary font-semibold">
          负责房东
        </view>
        <view class="flex flex-wrap gap-1.5">
          <view v-for="item in landlords" :key="item.id" class="app-touchable border border-app-border rounded-full border-solid px-2 py-1.5 text-xs" :class="landlordIds.includes(item.id) ? 'border-app-brand bg-surface-brand-soft text-app-brand' : 'text-content-secondary'" @click="toggleId(landlordIds, item.id)">
            {{ item.name }}
          </view>
        </view>
        <view class="mb-1.5 mt-3 text-xs text-content-primary font-semibold">
          负责楼栋
        </view>
        <view class="flex flex-wrap gap-1.5">
          <view v-for="item in buildings" :key="item.id" class="app-touchable border border-app-border rounded-full border-solid px-2 py-1.5 text-xs" :class="buildingIds.includes(item.id) ? 'border-app-brand bg-surface-brand-soft text-app-brand' : 'text-content-secondary'" @click="toggleId(buildingIds, item.id)">
            {{ item.estate?.display_name || item.estate?.name || '' }} {{ item.name }}
          </view>
        </view>
        <view class="mb-1.5 mt-3 text-xs text-content-primary font-semibold">
          负责小区
        </view>
        <view class="flex flex-wrap gap-1.5">
          <view v-for="item in estates" :key="item.id" class="app-touchable border border-app-border rounded-full border-solid px-2 py-1.5 text-xs" :class="estateIds.includes(item.id) ? 'border-app-brand bg-surface-brand-soft text-app-brand' : 'text-content-secondary'" @click="toggleId(estateIds, item.id)">
            {{ item.display_name || item.name }}
          </view>
        </view>
      </view>
      <template #footer>
        <wd-button block :loading="saving" :disabled="saving" @click="saveResponsibility">
          保存职责范围
        </wd-button>
      </template>
    </AppBottomSheet>
  </AppPage>
</template>
