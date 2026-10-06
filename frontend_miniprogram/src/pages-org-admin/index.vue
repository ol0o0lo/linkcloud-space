<script setup lang="ts">
import type { OrganizationAdminCapabilities, OrganizationAdminSectionKey } from '@/domain/organization-admin'
import type { OrganizationNavigationOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationAdminSections } from '@/domain/organization-admin'
import { getOrganizationAdminNavigation, getOrganizationAdminNavigationCapabilities } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppDashboardSkeleton from '@/components/app/AppDashboardSkeleton.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '组织管理', navigationStyle: 'custom', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const navigation = ref<OrganizationNavigationOut | null>(null)
const capabilities = ref<OrganizationAdminCapabilities>({})
const loading = ref(true)
const loadError = ref('')
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
    const [workspaceResult, capabilityResult] = await Promise.allSettled([
      getOrganizationAdminNavigation(appContextStore.organizationSlug),
      getOrganizationAdminNavigationCapabilities(appContextStore.organizationSlug),
    ])
    navigation.value = workspaceResult.status === 'fulfilled' ? workspaceResult.value : null
    capabilities.value = {
      ...(workspaceResult.status === 'fulfilled' ? workspaceResult.value.capabilities : {}),
      ...(capabilityResult.status === 'fulfilled' ? capabilityResult.value : {}),
    }
    if (workspaceResult.status === 'rejected' && capabilityResult.status === 'rejected' && !sections.value.length)
      loadError.value = '组织管理能力加载失败'
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '组织管理能力加载失败' }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openSection(key: OrganizationAdminSectionKey) {
  uni.navigateTo({ url: sectionRoutes[key] })
}

onShow(() => void loadNavigation())
onPullDownRefresh(loadNavigation)
</script>

<template>
  <view class="page-shell">
    <AppCustomNavigation title="组织管理" back scroll-mode="sticky" />
    <AppDashboardSkeleton v-if="loading && !navigation && !sections.length" :metric-count="2" compact />
    <AppErrorView v-else-if="loadError && !navigation && !sections.length" title="组织管理加载失败" :message="loadError" @retry="loadNavigation" />
    <template v-else>
      <view v-if="navigation" class="hero-card">
        <view class="hero-decoration hero-decoration--large" />
        <view class="hero-decoration hero-decoration--small" />
        <text class="eyebrow">当前组织</text>
        <strong>{{ navigation.organization.name }}</strong>
        <text>{{ navigation.member_count }} 名成员 · {{ navigation.team_count }} 个团队 · {{ navigation.pending_invite_count || 0 }} 条待处理邀请</text>
      </view>
      <view v-if="navigation" class="metric-grid">
        <view><strong>{{ navigation.ungrouped_member_count }}</strong><text>未分组成员</text></view>
        <view><strong>{{ navigation.unassigned_responsibility_count }}</strong><text>未配置职责</text></view>
      </view>
      <view v-if="sections.length" class="section-groups">
        <view v-for="group in sectionGroups" :key="group.title" class="section-group">
          <view class="section-heading">
            {{ group.title }}
          </view>
          <view class="section-list">
            <view v-for="section in group.items" :key="section.key" class="section-card app-touchable" hover-class="app-touchable--pressed" @click="openSection(section.key)">
              <view class="section-icon" :class="[section.icon]" />
              <view class="section-main">
                <strong>{{ section.title }}</strong>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!sections.length" class="quiet-card">
        当前账号没有组织管理权限
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 0 40rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.page-shell :deep(.app-custom-navigation) {
  margin: 0 -40rpx 40rpx;
}
.hero-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  min-height: 248rpx;
  overflow: hidden;
  padding: 32rpx 36rpx;
  border-radius: 40rpx;
  box-sizing: border-box;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-brand);
}
.hero-decoration {
  position: absolute;
  border: 1rpx solid rgb(255 255 255 / 16%);
  border-radius: 50%;
  background: rgb(255 255 255 / 6%);
  pointer-events: none;
}
.hero-decoration--large {
  top: -116rpx;
  right: -54rpx;
  width: 268rpx;
  height: 268rpx;
}
.hero-decoration--small {
  right: 174rpx;
  bottom: -78rpx;
  width: 154rpx;
  height: 154rpx;
}
.hero-card > text,
.hero-card > strong {
  position: relative;
  z-index: 1;
}
.hero-card strong {
  font-size: 42rpx;
}
.hero-card text {
  font-size: 23rpx;
  opacity: 0.82;
}
.eyebrow {
  font-size: 21rpx !important;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  margin-top: 28rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
}
.metric-grid view {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-height: 152rpx;
  padding: 28rpx 36rpx;
  box-sizing: border-box;
}
.metric-grid view + view {
  border-left: 1rpx solid var(--app-divider-color);
}
.metric-grid strong {
  color: var(--app-color-brand-active);
  font-size: 48rpx;
}
.metric-grid text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.section-groups {
  margin-top: 36rpx;
}
.section-group + .section-group {
  margin-top: 48rpx;
}
.section-heading {
  margin-bottom: 22rpx;
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.section-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}
.section-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 132rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.section-icon {
  color: var(--app-color-brand-active);
  font-size: 44rpx;
}
.section-main {
  min-width: 0;
  flex: 1;
}
.section-main strong,
.section-main text {
  display: block;
}
.section-main strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.quiet-card {
  margin-top: 24rpx;
  padding: 30rpx;
  border-radius: 22rpx;
  color: var(--app-text-muted);
  text-align: center;
  background: var(--app-bg-card);
}
</style>
