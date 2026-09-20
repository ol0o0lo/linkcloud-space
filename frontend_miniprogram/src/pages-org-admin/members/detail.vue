<script setup lang="ts">
import type { MemberOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import { getOrganizationAdminMember, patchOrganizationAdminMember, removeOrganizationAdminMember } from '@/features/organization-admin/service'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '成员详情', navigationStyle: 'custom' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const memberId = ref(0)
const member = ref<MemberOut | null>(null)
const employeeName = ref('')
const jobTitle = ref('')
const loading = ref(true)
const saving = ref(false)
const removing = ref(false)
const loadError = ref('')

async function loadMember() {
  loading.value = true
  loadError.value = ''
  try {
    member.value = await getOrganizationAdminMember(appContextStore.organizationSlug, memberId.value)
    employeeName.value = member.value.employee_name || ''
    jobTitle.value = member.value.job_title || ''
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '成员详情加载失败' }
  finally { loading.value = false }
}

async function saveMember() {
  if (saving.value || !member.value)
    return
  saving.value = true
  try {
    member.value = await patchOrganizationAdminMember(appContextStore.organizationSlug, member.value.pk, {
      employee_name: employeeName.value.trim() || null,
      job_title: jobTitle.value.trim() || null,
    })
    toast.success('成员资料已保存')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员资料保存失败') }
  finally { saving.value = false }
}

async function removeMember() {
  if (!member.value || member.value.is_owner || removing.value)
    return
  const confirmation = await uni.showModal({ title: '移除组织成员', content: `确定移除 ${member.value.employee_name || member.value.user.username} 吗？`, confirmText: '确认移除' })
  if (!confirmation.confirm)
    return
  removing.value = true
  try {
    await removeOrganizationAdminMember(appContextStore.organizationSlug, member.value.pk)
    toast.success('成员已移除')
    setTimeout(() => uni.navigateBack(), 350)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '成员移除失败') }
  finally { removing.value = false }
}

onLoad((options) => {
  memberId.value = Number(options?.id || 0)
  void loadMember()
})
</script>

<template>
  <view class="page-shell">
    <AppCustomNavigation title="成员详情" back scroll-mode="sticky" />
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载成员详情…" />
    <AppErrorView v-else-if="loadError" title="成员详情加载失败" :message="loadError" @retry="loadMember" />
    <template v-else-if="member">
      <view class="hero-card">
        <view class="member-avatar">
          {{ (member.employee_name || member.user.username).slice(0, 1) }}
        </view>
        <view class="member-main">
          <strong>{{ member.employee_name || member.user.username }}</strong><text>{{ member.user.email || member.user.username }}</text>
        </view>
        <wd-tag :type="member.is_owner ? 'warning' : 'primary'" variant="light">
          {{ member.is_owner ? '所有者' : '成员' }}
        </wd-tag>
      </view>
      <view class="section-title">
        组织内资料
      </view>
      <view class="form-card">
        <wd-input v-model="employeeName" label="员工姓名" placeholder="填写在当前组织内展示的姓名" clearable />
        <wd-input v-model="jobTitle" label="职位" placeholder="填写职位或岗位" clearable />
        <AppNotice title="组织内资料" description="员工姓名和职位只用于当前组织内展示，不会修改账号的个人资料。" compact />
        <wd-button v-if="!member.is_owner" block type="danger" variant="light" :loading="removing" :disabled="removing" @click="removeMember">
          移除组织成员
        </wd-button>
        <wd-button block :loading="saving" :disabled="saving" @click="saveMember">
          保存成员资料
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 0 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.page-shell :deep(.app-custom-navigation) {
  margin: 0 -24rpx 24rpx;
}
.hero-card,
.form-card {
  padding: 30rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.hero-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.member-avatar {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  color: var(--app-color-brand);
  font-size: 28rpx;
  font-weight: 700;
  background: var(--app-bg-brand-soft);
}
.member-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}
.hero-card strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.hero-card text {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.form-card {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}
.section-title {
  margin: 34rpx 6rpx 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.form-card :deep(.wd-button) {
  margin-top: 6rpx;
}
</style>
