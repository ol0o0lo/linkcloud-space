<script setup lang="ts">
import type { MeOut } from '@/features/account/service'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getCurrentUser, saveCurrentUserProfile, uploadPersonalAvatar } from '@/features/account/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '个人资料' } })

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
  <view class="account-page">
    <AppLoading v-if="loading && !user" text="正在加载个人资料…" />
    <AppErrorView v-else-if="loadError && !user" :message="loadError" @retry="loadProfile" />
    <template v-else-if="user">
      <view class="profile-card">
        <image class="avatar" :src="avatarUrl" mode="aspectFill" />
        <view class="avatar-main">
          <view class="avatar-title">
            头像
          </view>
          <view class="avatar-copy">
            支持 JPG、PNG、WebP，最大 10MB
          </view>
          <wd-button size="small" variant="plain" :loading="uploading" @click="chooseAvatar">
            更换头像
          </wd-button>
        </view>
      </view>

      <view class="form-card">
        <wd-input v-model="nickname" label="昵称" clearable :maxlength="64" placeholder="请输入昵称" />
        <wd-input v-model="timezone" label="时区" clearable placeholder="例如 Asia/Shanghai" />
        <wd-input :model-value="user.email" label="邮箱" readonly />
        <wd-input :model-value="user.phone_national_number || '未绑定'" label="手机号" readonly />
      </view>

      <wd-button block size="large" :loading="saving" @click="saveProfile">
        保存资料
      </wd-button>
    </template>
  </view>
</template>

<style scoped lang="scss">
.account-page {
  min-height: 100vh;
  padding: 28rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.profile-card,
.form-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 22rpx;
}
.avatar {
  width: 116rpx;
  height: 116rpx;
  border-radius: 50%;
  background: var(--app-bg-subtle);
}
.avatar-main {
  min-width: 0;
  flex: 1;
}
.avatar-title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 650;
}
.avatar-copy {
  margin: 8rpx 0 16rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.form-card {
  margin-bottom: 28rpx;
}
</style>
