<script setup lang="ts">
import type { MemberOut, MemberSearchOut, WorkspaceMemberOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { createOrganizationAdminMember, listOrganizationAdminMembers, listOrganizationWorkspaceMembers, searchOrganizationAdminMemberCandidates } from '@/features/organization-admin/service'
import { getOrganizationAdminMemberDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppEntityPickerOption from '@/components/app/AppEntityPickerOption.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppRecordListSkeleton from '@/components/app/AppRecordListSkeleton.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '成员管理', navigationStyle: 'custom', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const keyword = ref('')
const ungroupedOnly = ref(false)
onLoad(options => ungroupedOnly.value = options?.ungrouped === 'true')
const addVisible = ref(false)
const candidateKeyword = ref('')
const candidates = ref<MemberSearchOut[]>([])
const searching = ref(false)
const submitting = ref(false)
const hasSearch = computed(() => Boolean(keyword.value.trim()))

type MemberItem = MemberOut | WorkspaceMemberOut

function memberId(item: MemberItem) {
  return 'pk' in item ? item.pk : item.member_id
}

const memberPage = usePagedPage<MemberItem>({
  loader: async ({ page, pageSize }) => ungroupedOnly.value
    ? await listOrganizationWorkspaceMembers(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined, ungrouped: true })
    : await listOrganizationAdminMembers(appContextStore.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined }),
  pageSize: 15,
  keyOf: memberId,
})

async function refreshList() {
  await memberPage.refresh()
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
  const confirmation = await uni.showModal({ title: '添加空间成员', content: `确定添加 ${candidate.username} 到当前工作空间吗？`, confirmText: '确认添加' })
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

function openMember(item: MemberItem) {
  uni.navigateTo({ url: getOrganizationAdminMemberDetailRoute(memberId(item)) })
}

function memberName(item: MemberItem) {
  return item.employee_name || item.user.username
}

function memberInitial(item: MemberItem) {
  return memberName(item).slice(0, 1).toUpperCase()
}

function handleEmptyAction() {
  if (hasSearch.value) {
    keyword.value = ''
    void refreshList()
    return
  }
  addVisible.value = true
}
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="成员管理" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <view v-if="ungroupedOnly" class="mt-3 flex items-center justify-between text-xs text-content-secondary">
      <text>仅显示未加入团队的成员</text>
      <wd-button size="small" variant="plain" @click="ungroupedOnly = false; refreshList()">
        查看全部
      </wd-button>
    </view>
    <view class="member-heading mx-0 mb-3 mt-2.5 flex items-center justify-between">
      <text>共 {{ memberPage.total.value }} 位成员</text>
      <wd-button size="small" @click="addVisible = true">
        添加成员
      </wd-button>
    </view>
    <view class="member-search app-card-plain px-2 py-1.5">
      <wd-search v-model="keyword" placeholder="搜索员工姓名、账号或邮箱" hide-cancel @search="refreshList" @clear="refreshList" />
    </view>
    <view class="mt-2.5">
      <AppPagedList
        :items="memberPage.items.value"
        :item-key="memberId"
        :loading="memberPage.loading.value"
        :refreshing="memberPage.refreshing.value"
        :loading-more="memberPage.loadingMore.value"
        :finished="memberPage.finished.value"
        :error="memberPage.error.value"
        loading-text="正在加载成员…"
        :empty-text="hasSearch ? '没有找到相关成员' : '当前工作空间还没有成员'"
        :empty-description="hasSearch ? '试试清空搜索内容后重新查看。' : '添加成员后，可以继续配置团队、角色和房源分工。'"
        empty-icon="no-result"
        :empty-action-text="hasSearch ? '清除搜索' : '添加成员'"
        finished-text="没有更多成员了"
        @retry="refreshList"
        @empty-action="handleEmptyAction"
      >
        <template #loading>
          <AppRecordListSkeleton variant="member" />
        </template>
        <template #item="{ item }">
          <view class="member-card box-border min-h-14.5 flex app-touchable items-center gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card px-3.5 py-3" hover-class="app-touchable--pressed" @click="openMember(item)">
            <view class="member-avatar h-9 w-9 flex flex-none basis-9 items-center justify-center rounded-3 bg-surface-brand-soft text-size-sm text-app-brand-active font-bold">
              {{ memberInitial(item) }}
            </view>
            <view class="member-copy min-w-0 flex flex-1 flex-col gap-1">
              <strong>{{ memberName(item) }}</strong><text>账号 {{ item.user.username }} · {{ item.job_title || item.user.email || '未填写职位' }}</text>
            </view>
            <wd-tag v-if="item.is_owner" type="warning" variant="light" size="small">
              所有者
            </wd-tag>
            <view class="member-arrow i-carbon-chevron-right flex-none text-size-sm" />
          </view>
        </template>
      </AppPagedList>
    </view>
    <AppBottomSheet v-model:visible="addVisible" title="搜索可添加用户" height="tall">
      <view class="flex flex-col gap-1.5">
        <wd-search v-model="candidateKeyword" placeholder="输入用户名、姓名或邮箱" hide-cancel @search="searchCandidates" />
        <view v-if="searching" class="py-3.5 text-center text-content-muted">
          正在搜索…
        </view>
        <view v-for="candidate in candidates" :key="candidate.pk" class="rounded-app-md bg-surface-page p-2.5">
          <AppEntityPickerOption
            :title="((candidate.first_name || '') + (candidate.last_name || '')) || candidate.username"
            :description="candidate.email || candidate.username"
          >
            <template #trailing>
              <wd-button size="small" :loading="submitting" :disabled="submitting" @click="addMember(candidate)">
                添加
              </wd-button>
            </template>
          </AppEntityPickerOption>
        </view>
        <AppEmpty
          v-if="!searching && candidateKeyword.trim() && !candidates.length"
          title="未找到可添加用户"
          description="请检查手机号、邮箱或用户名是否输入完整。"
          icon="no-result"
          compact
        />
      </view>
    </AppBottomSheet>
  </AppPage>
</template>

<style scoped lang="scss">
.member-heading text {
  @apply text-content-muted text-size-xs;
}
.member-search {
  @apply rounded-3;
}
.member-copy strong {
  @apply overflow-hidden text-content-primary text-size-sm text-ellipsis whitespace-nowrap;
}
.member-copy text {
  @apply overflow-hidden text-content-muted text-size-2xs text-ellipsis whitespace-nowrap;
}
.member-arrow {
  color: #8a98aa;
}
</style>
