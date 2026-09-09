<script setup lang="ts">
import type { OrganizationAdminCapabilities, OrganizationAdminSectionKey } from '@/domain/organization-admin'
import type { OrganizationNavigationOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationAdminSections } from '@/domain/organization-admin'
import { getOrganizationAdminNavigation, getOrganizationAdminNavigationCapabilities } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '组织管理', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const navigation = ref<OrganizationNavigationOut | null>(null)
const capabilities = ref<OrganizationAdminCapabilities>({})
const loading = ref(true)
const loadError = ref('')
const sections = computed(() => getOrganizationAdminSections(capabilities.value))
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
    <AppLoading v-if="loading && !navigation && !sections.length" text="正在加载组织管理…" />
    <AppErrorView v-else-if="loadError && !navigation && !sections.length" title="组织管理加载失败" :message="loadError" @retry="loadNavigation" />
    <template v-else>
      <view v-if="navigation" class="hero-card">
        <text class="eyebrow">当前组织</text>
        <strong>{{ navigation.organization.name }}</strong>
        <text>{{ navigation.member_count }} 名成员 · {{ navigation.team_count }} 个团队 · {{ navigation.pending_invite_count || 0 }} 条待处理邀请</text>
      </view>
      <view v-if="navigation" class="metric-grid">
        <view><strong>{{ navigation.ungrouped_member_count }}</strong><text>未分组成员</text></view>
        <view><strong>{{ navigation.unassigned_responsibility_count }}</strong><text>未配置职责</text></view>
      </view>
      <view v-if="sections.length" class="section-list">
        <view v-for="section in sections" :key="section.key" class="section-card" @click="openSection(section.key)">
          <view class="section-icon" :class="[section.icon]" />
          <view class="section-main">
            <strong>{{ section.title }}</strong><text>{{ section.description }}</text>
          </view>
          <view class="i-carbon-chevron-right" />
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
  padding: 24rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.hero-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 32rpx;
  border-radius: 28rpx;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-organization);
}
.hero-card strong {
  font-size: 36rpx;
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
  gap: 16rpx;
  margin-top: 20rpx;
}
.metric-grid view {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.metric-grid strong {
  color: var(--app-color-primary);
  font-size: 34rpx;
}
.metric-grid text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.section-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}
.section-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.section-icon {
  color: var(--app-color-primary);
  font-size: 40rpx;
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
.section-main text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
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
