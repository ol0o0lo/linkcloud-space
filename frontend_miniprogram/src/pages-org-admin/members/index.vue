<script setup lang="ts">
import type { MemberOut, MemberSearchOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import { createOrganizationAdminMember, listOrganizationAdminMembers, removeOrganizationAdminMember, searchOrganizationAdminMemberCandidates } from '@/features/organization-admin/service'
import { getOrganizationAdminMemberDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '成员管理', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const keyword = ref('')
const addVisible = ref(false)
const candidateKeyword = ref('')
const candidates = ref<MemberSearchOut[]>([])
const searching = ref(false)
const submitting = ref(false)
const deleting = ref<number | null>(null)

const memberQuery = usePagedQuery<MemberOut>(({ page, pageSize }) => listOrganizationAdminMembers(appContextStore.organizationSlug, page, pageSize, {
  keyword: keyword.value.trim() || undefined,
}), { pageSize: 15 })

async function refreshList() {
  try {
    await memberQuery.refresh()
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await memberQuery.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

async function searchCandidates() {
  if (!candidateKeyword.value.trim())
    return
  searching.value = true
  try {
    candidates.value = await searchOrganizationAdminMemberCandidates(appContextStore.organizationSlug, candidateKeyword.value.trim())
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '候选成员搜索失败') }
  finally { searching.value = false }
}

async function addMember(candidate: MemberSearchOut) {
  if (submitting.value)
    return
  const confirmation = await uni.showModal({ title: '添加组织成员', content: `确定添加 ${candidate.username} 到当前组织吗？`, confirmText: '确认添加' })
  if (!confirmation.confirm)
    return
  submitting.value = true
  try {
    await createOrganizationAdminMember(appContextStore.organizationSlug, candidate.pk)
    toast.success('成员已添加')
    addVisible.value = false
    candidates.value = []
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员添加失败') }
  finally { submitting.value = false }
}

async function removeMember(item: MemberOut) {
  if (deleting.value)
    return
  const confirmation = await uni.showModal({ title: '移除组织成员', content: `移除 ${item.employee_name || item.user.username} 后，其组织权限将立即失效。`, confirmText: '确认移除' })
  if (!confirmation.confirm)
    return
  deleting.value = item.pk
  try {
    await removeOrganizationAdminMember(appContextStore.organizationSlug, item.pk)
    toast.success('成员已移除')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员移除失败') }
  finally { deleting.value = null }
}

function openMember(item: MemberOut) {
  uni.navigateTo({ url: getOrganizationAdminMemberDetailRoute(item.pk) })
}

onShow(() => void refreshList())
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <view class="toolbar">
      <wd-search v-model="keyword" placeholder="搜索员工姓名、账号或邮箱" hide-cancel @search="refreshList" @clear="refreshList" />
      <wd-button size="small" @click="addVisible = true">
        添加成员
      </wd-button>
    </view>
    <view v-if="memberQuery.items.value.length" class="card-list">
      <view v-for="item in memberQuery.items.value" :key="item.pk" class="record-card">
        <view class="record-main" @click="openMember(item)">
          <view class="title-line">
            <strong>{{ item.employee_name || item.user.username }}</strong><wd-tag v-if="item.is_owner" type="warning" variant="light" size="small">
              Owner
            </wd-tag>
          </view>
          <text>{{ item.job_title || item.user.email || '未填写职位' }}</text>
        </view>
        <wd-button type="danger" variant="plain" size="small" :loading="deleting === item.pk" :disabled="deleting !== null" @click="removeMember(item)">
          移除
        </wd-button>
      </view>
    </view>
    <AppListState :loading="memberQuery.loading.value" :has-items="Boolean(memberQuery.items.value.length)" :finished="memberQuery.finished.value" :error-message="memberQuery.error.value?.message || ''" loading-text="正在加载成员…" empty-text="当前组织暂无成员" finished-text="没有更多成员了" @retry="refreshList" />
    <wd-popup v-model="addVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx; max-height: 78vh; overflow: auto;">
      <view class="popup-title">
        搜索可添加用户
      </view>
      <wd-search v-model="candidateKeyword" placeholder="输入用户名、姓名或邮箱" hide-cancel @search="searchCandidates" />
      <view v-if="searching" class="hint">
        正在搜索…
      </view>
      <view v-for="candidate in candidates" :key="candidate.pk" class="candidate-card">
        <view><strong>{{ ((candidate.first_name || '') + (candidate.last_name || '')) || candidate.username }}</strong><text>{{ candidate.email || candidate.username }}</text></view>
        <wd-button size="small" :loading="submitting" :disabled="submitting" @click="addMember(candidate)">
          添加
        </wd-button>
      </view>
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
.toolbar {
  display: flex;
  align-items: center;
  gap: 14rpx;
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
.record-card,
.candidate-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 25rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.record-main,
.candidate-card > view {
  min-width: 0;
  flex: 1;
}
.title-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.record-card strong,
.candidate-card strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.record-card text,
.candidate-card text {
  display: block;
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.popup-title {
  margin-bottom: 16rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.candidate-card {
  margin-top: 14rpx;
  background: var(--app-bg-page);
}
.hint {
  padding: 30rpx;
  color: var(--app-text-muted);
  text-align: center;
}
</style>
