<script setup lang="ts">
import type { OrganizationNavigationOut, TeamOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { canManageTeam } from '@/domain/organization-admin'
import { createOrganizationAdminTeam, getOrganizationAdminNavigation, listOrganizationAdminTeams, removeOrganizationAdminTeam } from '@/features/organization-admin/service'
import { getOrganizationAdminTeamDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '团队管理', navigationStyle: 'custom', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const navigation = ref<OrganizationNavigationOut | null>(null)
const keyword = ref('')
const createVisible = ref(false)
const teamName = ref('')
const teamPhone = ref('')
const teamWechat = ref('')
const creating = ref(false)
const deleting = ref<number | null>(null)
const canCreate = computed(() => navigation.value?.capabilities.team_create === true)
const hasSearch = computed(() => Boolean(keyword.value.trim()))

const teamPage = usePagedPage<TeamOut>({
  loader: ({ page, pageSize }) => listOrganizationAdminTeams(appContextStore.organizationSlug, page, pageSize, {
    keyword: keyword.value.trim() || undefined,
  }),
  pageSize: 15,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

async function refreshList() {
  try {
    const [nextNavigation] = await Promise.all([
      getOrganizationAdminNavigation(appContextStore.organizationSlug),
      teamPage.refresh(),
    ])
    navigation.value = nextNavigation
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await teamPage.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

async function submitTeam() {
  if (creating.value || !teamName.value.trim())
    return
  const confirmation = await uni.showModal({ title: '创建团队', content: `将在当前组织内创建团队“${teamName.value.trim()}”。`, confirmText: '确认创建' })
  if (!confirmation.confirm)
    return
  creating.value = true
  try {
    await createOrganizationAdminTeam(appContextStore.organizationSlug, {
      name: teamName.value.trim(),
      phone: teamPhone.value.trim(),
      wechat: teamWechat.value.trim(),
    })
    toast.success('团队已创建')
    createVisible.value = false
    teamName.value = ''
    teamPhone.value = ''
    teamWechat.value = ''
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '团队创建失败') }
  finally { creating.value = false }
}

async function deleteTeam(item: TeamOut) {
  if (deleting.value || !navigation.value || !canManageTeam(navigation.value.capabilities, item.id, 'delete'))
    return
  const confirmation = await uni.showModal({ title: '删除团队', content: `删除“${item.name}”后无法恢复，成员仍保留在组织内。`, confirmText: '确认删除' })
  if (!confirmation.confirm)
    return
  deleting.value = item.id
  try {
    await removeOrganizationAdminTeam(appContextStore.organizationSlug, item.id)
    toast.success('团队已删除')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '团队删除失败') }
  finally { deleting.value = null }
}

function openTeam(item: TeamOut) {
  uni.navigateTo({ url: getOrganizationAdminTeamDetailRoute(item.id) })
}

function handleEmptyAction() {
  if (hasSearch.value) {
    keyword.value = ''
    void refreshList()
    return
  }
  if (canCreate.value)
    createVisible.value = true
}

onShow(() => void refreshList())
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="团队管理" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <AppListToolbar v-model:keyword="keyword" card search-placeholder="搜索团队名称" :action-text="canCreate ? '创建团队' : ''" @search="refreshList" @clear="refreshList" @action="createVisible = true" />
    <view class="mt-2.5">
      <AppPagedList
        :items="teamPage.items.value"
        item-key="id"
        :loading="teamPage.loading.value"
        :refreshing="teamPage.refreshing.value"
        :loading-more="teamPage.loadingMore.value"
        :finished="teamPage.finished.value"
        :error="teamPage.error.value"
        loading-text="正在加载团队…"
        :empty-text="hasSearch ? '没有找到相关团队' : '当前组织还没有团队'"
        :empty-description="hasSearch ? '试试清空搜索内容后重新查看。' : canCreate ? '创建团队后，可以按团队组织成员和业务协作。' : '当前账号没有创建团队的权限。'"
        empty-icon="no-result"
        :empty-action-text="hasSearch ? '清除搜索' : canCreate ? '创建团队' : ''"
        finished-text="没有更多团队了"
        @retry="refreshList"
        @empty-action="handleEmptyAction"
      >
        <template #item="{ item }">
          <AppRecordCard clickable @click="openTeam(item)">
            <template #title>
              {{ item.name }}
            </template>
            <template #description>
              {{ item.member_details.length }} 名成员 · {{ item.phone || item.wechat || '未填写联系方式' }}
            </template>
            <template v-if="navigation && canManageTeam(navigation.capabilities, item.id, 'delete')" #actions>
              <wd-button type="danger" variant="plain" size="small" :loading="deleting === item.id" :disabled="deleting !== null" @click="deleteTeam(item)">
                删除
              </wd-button>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>
    <AppBottomSheet v-model:visible="createVisible" title="创建团队" height="compact">
      <view class="flex flex-col gap-1.5">
        <wd-input v-model="teamName" label="团队名称" placeholder="请输入团队名称" clearable />
        <wd-input v-model="teamPhone" label="联系电话" placeholder="可选" clearable />
        <wd-input v-model="teamWechat" label="客服微信" placeholder="可选" clearable />
      </view>
      <template #footer>
        <wd-button block :loading="creating" :disabled="creating" @click="submitTeam">
          创建团队
        </wd-button>
      </template>
    </AppBottomSheet>
  </AppPage>
</template>
