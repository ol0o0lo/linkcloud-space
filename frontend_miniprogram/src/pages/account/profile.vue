<script setup lang="ts">
import type { MeOut } from '@/features/account/service'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getCurrentUser, saveCurrentUserProfile, uploadPersonalAvatar } from '@/features/account/service'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '个人资料', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const user = ref<MeOut | null>(null)
const nickname = ref('')
const timezone = ref('')
const avatarUrl = ref('')
const avatarMediaId = ref<number | null>(null)
const loading = ref(false)
const saving = ref(false)
const uploading = ref(false)
const loadError = ref('')

async function loadProfile() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await getCurrentUser()
    user.value = result
    nickname.value = result.last_name || result.first_name || result.username
    timezone.value = result.timezone || 'Asia/Shanghai'
    avatarUrl.value = result.avatar?.[0]?.thumbnail || result.avatar?.[0]?.url || '/static/images/default-avatar.png'
    avatarMediaId.value = null
  }
  catch {
    loadError.value = '个人资料加载失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}

async function chooseAvatar() {
  uploading.value = true
  try {
    const media = await uploadPersonalAvatar()
    if (!media)
      throw new Error('头像上传结果为空')
    avatarMediaId.value = media.id
    avatarUrl.value = media.thumbnail || media.url
    uni.showToast({ title: '头像已上传，保存后生效', icon: 'none' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '头像上传失败', icon: 'none' })
  }
  finally {
    uploading.value = false
  }
}

async function saveProfile() {
  if (!user.value)
    return
  if (!nickname.value.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await saveCurrentUserProfile(user.value.id, {
      nickname: nickname.value,
      timezone: timezone.value,
      avatarMediaId: avatarMediaId.value,
    })
    await appContextStore.refreshAuthenticatedContext()
    uni.showToast({ title: '个人资料已更新', icon: 'success' })
    await loadProfile()
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败，请稍后重试', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

onShow(() => void loadProfile())
</script>

<template>
  <AppPage variant="form" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="个人资料" back scroll-mode="sticky" />
    </template>
    <view class="account-page box-border min-h-screen bg-surface-page px-5 pb-3.5 pt-6">
      <AppLoading v-if="loading && !user" text="正在加载个人资料…" />
      <AppErrorView v-else-if="loadError && !user" :message="loadError" @retry="loadProfile" />
      <template v-else-if="user">
        <view class="profile-card mb-6.5 box-border min-h-31 flex items-center gap-3 rounded-4">
          <image class="avatar h-18 w-18 rounded-full bg-surface-subtle" :src="avatarUrl" mode="aspectFill" />
          <view class="avatar-main min-w-0 flex-1">
            <view class="avatar-title text-size-sm text-content-primary font-bold">
              头像
            </view>
            <view class="avatar-copy mx-0 mb-2 mt-1 text-size-2xs text-content-muted">
              支持 JPG、PNG、WebP，最大 10MB
            </view>
            <wd-button size="small" variant="plain" :loading="uploading" @click="chooseAvatar">
              更换头像
            </wd-button>
          </view>
        </view>

        <view class="form-card mb-6 flex flex-col gap-3.5 rounded-4">
          <wd-input v-model="nickname" label="昵称" clearable :maxlength="64" placeholder="请输入昵称" />
          <wd-input v-model="timezone" label="时区" clearable placeholder="例如 Asia/Shanghai" />
          <wd-input :model-value="user.email" label="邮箱" readonly />
          <wd-input :model-value="user.phone_national_number || '未绑定'" label="手机号" readonly />
        </view>

        <view class="save-action sticky bottom-0">
          <wd-button block size="large" :loading="saving" @click="saveProfile">
            保存资料
          </wd-button>
        </view>
      </template>
    </view>
  </AppPage>
</template>

<style scoped>
.profile-card,
.form-card {
  @apply p-3.5 bg-surface-card;
}
.form-card {
  @apply p-0 bg-transparent;
}
:deep(.form-card .wd-input) {
  @apply overflow-hidden min-h-14 py-2 px-3.5 border-hairline border-solid border-app-border rounded-3.5 box-border bg-surface-card;
}
.save-action {
  @apply pt-3.5;
  @apply pb-safe;
  background: linear-gradient(180deg, transparent, var(--app-bg-page) 28%);
}
</style>
