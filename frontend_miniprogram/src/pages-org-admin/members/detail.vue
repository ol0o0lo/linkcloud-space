<script setup lang="ts">
import type { MemberOut } from '@/features/organization-admin/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import { getOrganizationAdminMember, patchOrganizationAdminMember } from '@/features/organization-admin/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '成员详情' } })

const toast = useToast()
const appContextStore = useAppContextStore()
const memberId = ref(0)
const member = ref<MemberOut | null>(null)
const employeeName = ref('')
const jobTitle = ref('')
const loading = ref(true)
const saving = ref(false)
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

onLoad((options) => {
  memberId.value = Number(options?.id || 0)
  void loadMember()
})
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载成员详情…" />
    <AppErrorView v-else-if="loadError" title="成员详情加载失败" :message="loadError" @retry="loadMember" />
    <template v-else-if="member">
      <view class="hero-card">
        <strong>{{ member.employee_name || member.user.username }}</strong>
        <text>{{ member.user.email || member.user.username }}</text>
        <wd-tag v-if="member.is_owner" type="warning" variant="light">
          组织 Owner
        </wd-tag>
      </view>
      <view class="form-card">
        <wd-input v-model="employeeName" label="员工姓名" placeholder="填写在当前组织内展示的姓名" clearable />
        <wd-input v-model="jobTitle" label="职位" placeholder="填写职位或岗位" clearable />
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
  padding: 24rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.hero-card,
.form-card {
  padding: 30rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.hero-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
}
.hero-card strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
}
.hero-card text {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.form-card {
  margin-top: 20rpx;
}
.form-card :deep(.wd-button) {
  margin-top: 28rpx;
}
</style>
