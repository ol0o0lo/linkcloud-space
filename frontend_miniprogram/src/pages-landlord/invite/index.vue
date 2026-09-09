<script setup lang="ts">
import type { LandlordInvitationOut } from '@/features/landlord/service'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { acceptLandlordInvitation, getLandlordInvitation } from '@/features/landlord/service'
import { APP_ROUTES } from '@/modules/routes'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '认领房东关系' } })

const appContextStore = useAppContextStore()
const token = ref('')
const invitation = ref<LandlordInvitationOut | null>(null)
const loading = ref(true)
const accepting = ref(false)
const loadError = ref('')

async function loadInvitation() {
  loading.value = true
  loadError.value = ''
  try {
    invitation.value = await getLandlordInvitation(token.value)
  }
  catch {
    loadError.value = '邀请不存在、已过期或已被使用'
  }
  finally {
    loading.value = false
  }
}

async function acceptInvitation() {
  const redirect = `${APP_ROUTES.landlordInvite}?token=${encodeURIComponent(token.value)}`
  if (!appContextStore.authenticated) {
    uni.navigateTo({ url: `${APP_ROUTES.login}?redirect=${encodeURIComponent(redirect)}` })
    return
  }
  accepting.value = true
  try {
    const result = await acceptLandlordInvitation(token.value)
    await appContextStore.refreshAuthenticatedContext()
    await appContextStore.switchMode({ mode: 'landlord', landlordContactId: result.contact_id })
    uni.showToast({ title: '房东关系已认领', icon: 'success' })
    uni.reLaunch({ url: APP_ROUTES.home })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '认领失败，请稍后重试', icon: 'none' })
  }
  finally {
    accepting.value = false
  }
}

onLoad((options) => {
  token.value = String(options?.token || '')
  if (!token.value) {
    loadError.value = '邀请参数不正确'
    loading.value = false
    return
  }
  void loadInvitation()
})
</script>

<template>
  <view class="invite-page">
    <AppLoading v-if="loading" text="正在读取邀请…" />
    <AppErrorView v-else-if="loadError" title="无法认领" :message="loadError" @retry="loadInvitation" />
    <view v-else-if="invitation" class="invite-card">
      <view class="invite-icon i-carbon-home" />
      <view class="invite-title">
        {{ invitation.organization_name }} 邀请你认领房东关系
      </view>
      <view class="invite-copy">
        联系人：{{ invitation.contact_name }}
      </view>
      <view class="invite-copy">
        手机号：{{ invitation.invitee_phone_masked }}
      </view>
      <view class="invite-copy">
        有效期至：{{ new Date(invitation.expires_at).toLocaleString('zh-CN', { hour12: false }) }}
      </view>
      <wd-button block size="large" :loading="accepting" @click="acceptInvitation">
        {{ appContextStore.authenticated ? '确认认领' : '登录后认领' }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.invite-page {
  min-height: 100vh;
  padding: 64rpx 28rpx;
  box-sizing: border-box;
  background: var(--app-bg-page);
}
.invite-card {
  padding: 44rpx 34rpx;
  border-radius: 28rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.invite-icon {
  color: var(--app-color-warm);
  font-size: 68rpx;
}
.invite-title {
  margin: 26rpx 0;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.45;
}
.invite-copy {
  margin-bottom: 16rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
}
.invite-copy:last-of-type {
  margin-bottom: 36rpx;
}
</style>
