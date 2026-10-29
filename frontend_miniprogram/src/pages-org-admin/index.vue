<script setup lang="ts">
import type { OrganizationAdminCapabilities, OrganizationAdminSectionKey } from '@/domain/organization-admin'
import type { OrganizationNavigationOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationAdminSections } from '@/domain/organization-admin'
import { getOrganizationAdminNavigation, getOrganizationAdminNavigationCapabilities } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import { getMigrationOptions } from '@/services/manual/data-migration'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppDashboardSkeleton from '@/components/app/AppDashboardSkeleton.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '空间管理', navigationStyle: 'custom', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const navigation = ref<OrganizationNavigationOut | null>(null)
const capabilities = ref<OrganizationAdminCapabilities>({})
const loading = ref(true)
const loadError = ref('')
const canMigrateData = ref(false)
const sections = computed(() => getOrganizationAdminSections(capabilities.value))
const sectionGroups = computed(() => [
  { title: '人员与协作', items: sections.value.filter(section => ['members', 'invitations', 'teams', 'roles'].includes(section.key)) },
  { title: '业务与配置', items: sections.value.filter(section => ['responsibilities', 'settings', 'subscription', 'notification-dispatches'].includes(section.key)) },
].filter(group => group.items.length))
const sectionRoutes: Record<OrganizationAdminSectionKey, string> = {
  'members': APP_ROUTES.organizationAdminMembers,
  'invitations': APP_ROUTES.organizationAdminInvitations,
  'teams': APP_ROUTES.organizationAdminTeams,
  'roles': APP_ROUTES.organizationAdminRoles,
  'responsibilities': APP_ROUTES.organizationAdminResponsibilities,
  'settings': APP_ROUTES.organizationAdminSettings,
  'subscription': APP_ROUTES.organizationAdminSubscription,
  'notification-dispatches': APP_ROUTES.organizationAdminNotificationDispatches,
}

async function loadNavigation() {
  loading.value = true
  loadError.value = ''
  try {
    const [workspaceResult, capabilityResult, migrationResult] = await Promise.allSettled([
      getOrganizationAdminNavigation(appContextStore.organizationSlug),
      getOrganizationAdminNavigationCapabilities(appContextStore.organizationSlug),
      getMigrationOptions(appContextStore.organizationSlug),
    ])
    navigation.value = workspaceResult.status === 'fulfilled' ? workspaceResult.value : null
    canMigrateData.value = migrationResult.status === 'fulfilled' && migrationResult.value.can_manage
    capabilities.value = {
      ...(workspaceResult.status === 'fulfilled' ? workspaceResult.value.capabilities : {}),
      ...(capabilityResult.status === 'fulfilled' ? capabilityResult.value : {}),
    }
    if (workspaceResult.status === 'rejected' && capabilityResult.status === 'rejected' && !sections.value.length)
      loadError.value = '空间管理信息加载失败'
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '空间管理信息加载失败' }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openSection(key: OrganizationAdminSectionKey) {
  uni.navigateTo({ url: sectionRoutes[key] })
}

function openMemberFilter() {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminMembers}?ungrouped=true` })
}

function openResponsibilityFilter() {
  uni.navigateTo({ url: APP_ROUTES.organizationAdminResponsibilities })
}
function openMigration() {
  uni.navigateTo({ url: APP_ROUTES.organizationAdminDataMigration })
}

onShow(() => void loadNavigation())
onPullDownRefresh(loadNavigation)
</script>

<template>
  <view class="page-shell box-border min-h-screen bg-surface-page px-5 pb-7 pt-0">
    <AppCustomNavigation title="空间管理" back scroll-mode="sticky" />
    <AppDashboardSkeleton v-if="loading && !navigation && !sections.length" :metric-count="2" compact />
    <AppErrorView v-else-if="loadError && !navigation && !sections.length" title="空间管理加载失败" :message="loadError" @retry="loadNavigation" />
    <template v-else>
      <view v-if="navigation" class="hero-card relative box-border min-h-31 flex flex-col gap-2 overflow-hidden rounded-5 px-4.5 py-4 text-content-on-brand bg-gradient-brand">
        <view class="hero-decoration hero-decoration--large pointer-events-none absolute h-34 w-34 rounded-full -right-6.5 -top-14.5" />
        <view class="hero-decoration hero-decoration--small pointer-events-none absolute right-22 h-19 w-19 rounded-full -bottom-9.5" />
        <text class="eyebrow">当前工作空间</text>
        <strong>{{ navigation.organization.name }}</strong>
        <text>{{ navigation.member_count }} 名成员 · {{ navigation.team_count }} 个团队 · {{ navigation.pending_invite_count || 0 }} 条待处理邀请</text>
      </view>
      <view v-if="navigation" class="metric-grid grid grid-cols-2 mt-3.5 gap-0 overflow-hidden border-hairline border-app-card rounded-app-lg border-solid bg-surface-card">
        <view class="app-touchable" @click="openMemberFilter">
          <strong>{{ navigation.ungrouped_member_count }}</strong><text>未分组成员 ›</text>
        </view>
        <view class="app-touchable" @click="openResponsibilityFilter">
          <strong>{{ navigation.unassigned_responsibility_count }}</strong><text>未配置职责 ›</text>
        </view>
      </view>
      <view v-if="sections.length" class="section-groups mt-4.5">
        <view v-for="group in sectionGroups" :key="group.title" class="section-group">
          <view class="section-heading mb-3 text-size-base text-content-primary font-bold">
            {{ group.title }}
          </view>
          <view class="section-list grid grid-cols-2 gap-3">
            <view v-for="section in group.items" :key="section.key" class="section-card box-border min-h-17 flex app-touchable items-center gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3" hover-class="app-touchable--pressed" @click="openSection(section.key)">
              <view class="section-icon text-size-xl" :class="[section.icon]" />
              <view class="section-main min-w-0 flex-1">
                <strong>{{ section.title }}</strong>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!sections.length" class="quiet-card mt-3 rounded-3 bg-surface-card p-4 text-center text-content-muted">
        当前账号没有空间管理权限
      </view>
      <view v-if="canMigrateData" class="section-group migration-entry mt-4.5">
        <view class="section-heading mb-3 text-size-base text-content-primary font-bold">
          数据管理
        </view>
        <view class="section-card box-border min-h-17 flex app-touchable items-center gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3" hover-class="app-touchable--pressed" @click="openMigration">
          <view class="section-icon i-carbon-data-backup text-size-xl" />
          <view class="section-main min-w-0 flex-1">
            <strong>数据迁移</strong>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page-shell :deep(.app-custom-navigation) {
  @apply mt-0 -mx-5 mb-5;
}
.hero-decoration {
  border: 1rpx solid rgb(255 255 255 / 16%);
  background: rgb(255 255 255 / 6%);
}
.hero-card > text,
.hero-card > strong {
  @apply relative z-1;
}
.hero-card strong {
  @apply text-size-xl;
}
.hero-card text {
  @apply text-size-xs opacity-82;
}
.eyebrow {
  @apply text-size-2xs !important;
}
.metric-grid view {
  @apply flex flex-col gap-1.5 min-h-19 py-3.5 px-4.5 box-border;
}
.metric-grid view + view {
  @apply border-l-hairline border-l-solid border-l-app-divider;
}
.metric-grid strong {
  @apply text-app-brand-active text-size-2xl;
}
.metric-grid text {
  @apply text-content-muted text-size-2xs;
}
.section-group + .section-group {
  @apply mt-6;
}
.section-icon {
  @apply text-app-brand-active;
}
.section-main strong,
.section-main text {
  @apply block;
}
.section-main strong {
  @apply text-content-primary text-size-sm;
}
</style>
