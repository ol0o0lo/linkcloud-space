<script setup lang="ts">
import type { OrganizationNavigationOut, TeamOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { canManageTeam } from '@/domain/organization-admin'
import { createOrganizationAdminTeam, getOrganizationAdminNavigation, listOrganizationAdminTeams, removeOrganizationAdminTeam } from '@/features/organization-admin/service'
import { getOrganizationAdminTeamDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '团队管理', enablePullDownRefresh: true } })

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

const teamQuery = usePagedQuery<TeamOut>(({ page, pageSize }) => listOrganizationAdminTeams(appContextStore.organizationSlug, page, pageSize, {
  keyword: keyword.value.trim() || undefined,
}), { pageSize: 15 })

async function refreshList() {
  try {
    const [nextNavigation] = await Promise.all([
      getOrganizationAdminNavigation(appContextStore.organizationSlug),
      teamQuery.refresh(),
    ])
    navigation.value = nextNavigation
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await teamQuery.loadMore()
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

onShow(() => void refreshList())
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <view class="toolbar">
      <wd-search v-model="keyword" placeholder="搜索团队名称" hide-cancel @search="refreshList" @clear="refreshList" />
      <wd-button v-if="canCreate" size="small" @click="createVisible = true">
        创建团队
      </wd-button>
    </view>
    <view v-if="teamQuery.items.value.length" class="card-list">
      <view v-for="item in teamQuery.items.value" :key="item.id" class="record-card">
        <view class="record-main" @click="openTeam(item)">
          <strong>{{ item.name }}</strong>
          <text>{{ item.member_details.length }} 名成员 · {{ item.phone || item.wechat || '未填写联系方式' }}</text>
        </view>
        <wd-button v-if="navigation && canManageTeam(navigation.capabilities, item.id, 'delete')" type="danger" variant="plain" size="small" :loading="deleting === item.id" :disabled="deleting !== null" @click="deleteTeam(item)">
          删除
        </wd-button>
      </view>
    </view>
    <AppListState :loading="teamQuery.loading.value" :has-items="Boolean(teamQuery.items.value.length)" :finished="teamQuery.finished.value" :error-message="teamQuery.error.value?.message || ''" loading-text="正在加载团队…" empty-text="当前组织暂无团队" finished-text="没有更多团队了" @retry="refreshList" />
    <wd-popup v-model="createVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 34rpx 28rpx;">
      <view class="popup-title">
        创建团队
      </view>
      <wd-input v-model="teamName" label="团队名称" placeholder="请输入团队名称" clearable />
      <wd-input v-model="teamPhone" label="联系电话" placeholder="可选" clearable />
      <wd-input v-model="teamWechat" label="客服微信" placeholder="可选" clearable />
      <wd-button block :loading="creating" :disabled="creating" @click="submitTeam">
        创建团队
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
.toolbar,
.record-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.toolbar {
  padding: 14rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.toolbar :deep(.wd-search) {
  min-width: 0;
  flex: 1;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}
.record-card {
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
  font-size: 28rpx;
}
.record-main text {
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.popup-title {
  margin-bottom: 20rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
</style>
