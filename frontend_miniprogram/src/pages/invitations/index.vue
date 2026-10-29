<script setup lang="ts">
import type { InvitationParams, InvitationViewModel } from '@/domain/invitations'
import type { LandlordInvitationAcceptOut } from '@/features/invitations/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import {
  normalizeLandlordInvitation,
  normalizeOrganizationInvitation,
  resolveInvitationParams,
  shouldVerifyInvitationPhone,
} from '@/domain/invitations'
import {
  acceptLandlordInvitation,
  acceptOrganizationInvitation,
  declineOrganizationInvitation,
  getLandlordInvitation,
  getOrganizationInvitation,
} from '@/features/invitations/service'
import { APP_ROUTES, getInvitationRoute, getLoginRoute } from '@/modules/routes'
import AppLoading from '@/components/app/AppLoading.vue'
import AppStateCard from '@/components/app/AppStateCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '处理邀请',
    navigationStyle: 'custom',
  },
})

const appContextStore = useAppContextStore()
const params = ref<InvitationParams | null>(null)
const invitation = ref<InvitationViewModel | null>(null)
const landlordAcceptResult = ref<LandlordInvitationAcceptOut | null>(null)
const loading = ref(true)
const accepting = ref(false)
const declining = ref(false)
const accepted = ref(false)
const entering = ref(false)
const loadError = ref('')
const enterError = ref('')

const invitationRoute = computed(() => params.value ? getInvitationRoute(params.value.kind, params.value.credential) : APP_ROUTES.invitation)
const acceptedTitle = computed(() => invitation.value?.kind === 'organization' ? '已加入工作空间' : '房东档案已关联')
const primaryActionText = computed(() => {
  if (!appContextStore.authenticated)
    return '登录后接受'
  if (invitation.value && shouldVerifyInvitationPhone(invitation.value, appContextStore.user))
    return '验证手机号后接受'
  return invitation.value?.kind === 'organization' ? '确认加入' : '接受邀请并关联'
})
const acceptedActionText = computed(() => enterError.value ? '重新进入工作空间' : '进入工作空间')
const pendingStateDescription = computed(() => {
  if (!appContextStore.authenticated)
    return '登录后即可核对接收账号并接受邀请，邀请信息会在登录后继续保留。'
  if (invitation.value && shouldVerifyInvitationPhone(invitation.value, appContextStore.user))
    return '当前账号需要先完成手机号验证，验证后会返回这里继续处理邀请。'
  return invitation.value?.kind === 'organization'
    ? '确认后将加入该工作空间，并获得邀请中对应的工作空间权限。'
    : '确认后将关联房东档案，可在房东模式查看关联房源与租约。'
})

function showError(error: unknown, fallback: string) {
  uni.showToast({ title: error instanceof Error ? error.message : fallback, icon: 'none' })
}

function redirectToLogin() {
  uni.navigateTo({ url: getLoginRoute(invitationRoute.value) })
}

function redirectToPhoneVerification() {
  uni.reLaunch({ url: `${APP_ROUTES.phoneVerification}?redirect=${encodeURIComponent(invitationRoute.value)}` })
}

function ensureAuthenticated(): boolean {
  if (!appContextStore.authenticated) {
    redirectToLogin()
    return false
  }
  if (invitation.value && shouldVerifyInvitationPhone(invitation.value, appContextStore.user)) {
    redirectToPhoneVerification()
    return false
  }
  return true
}

async function loadInvitation() {
  if (!params.value) {
    loadError.value = '邀请链接不完整，请向邀请人重新获取链接'
    loading.value = false
    return
  }

  loading.value = true
  loadError.value = ''
  try {
    if (params.value.kind === 'organization') {
      const result = await getOrganizationInvitation(params.value.credential)
      invitation.value = normalizeOrganizationInvitation(result)
      accepted.value = result.is_already_member
    }
    else {
      invitation.value = normalizeLandlordInvitation(await getLandlordInvitation(params.value.credential))
    }

    if (appContextStore.authenticated && invitation.value && shouldVerifyInvitationPhone(invitation.value, appContextStore.user))
      redirectToPhoneVerification()
  }
  catch (error) {
    invitation.value = null
    loadError.value = error instanceof Error ? error.message : '邀请不存在、已过期或已被处理'
  }
  finally {
    loading.value = false
  }
}

async function enterAcceptedContext() {
  if (!invitation.value)
    return

  entering.value = true
  enterError.value = ''
  try {
    await appContextStore.refreshAuthenticatedContext()
    if (invitation.value.kind === 'organization') {
      await appContextStore.switchMode({ mode: 'organization', organizationSlug: invitation.value.organizationSlug })
    }
    else {
      const contactId = landlordAcceptResult.value?.contact_id
      if (!contactId)
        throw new Error('未能读取已关联的房东档案，请重新打开邀请链接')
      await appContextStore.switchMode({ mode: 'landlord', landlordContactId: contactId })
    }
    uni.reLaunch({ url: APP_ROUTES.home })
  }
  catch (error) {
    enterError.value = error instanceof Error ? error.message : '邀请已接受，但工作空间刷新失败'
  }
  finally {
    entering.value = false
  }
}

async function acceptInvitation() {
  if (!params.value || !invitation.value || invitation.value.expired || !ensureAuthenticated())
    return
  if (accepted.value) {
    await enterAcceptedContext()
    return
  }

  accepting.value = true
  try {
    if (params.value.kind === 'organization') {
      await acceptOrganizationInvitation(params.value.credential)
    }
    else {
      landlordAcceptResult.value = await acceptLandlordInvitation(params.value.credential)
    }
    accepted.value = true
    uni.showToast({ title: acceptedTitle.value, icon: 'success' })
    await enterAcceptedContext()
  }
  catch (error) {
    showError(error, '接受邀请失败，请稍后重试')
  }
  finally {
    accepting.value = false
  }
}

async function declineInvitation() {
  if (!params.value || params.value.kind !== 'organization' || !ensureAuthenticated())
    return

  declining.value = true
  try {
    await declineOrganizationInvitation(params.value.credential)
    uni.showToast({ title: '已拒绝邀请', icon: 'success' })
    uni.reLaunch({ url: APP_ROUTES.home })
  }
  catch (error) {
    showError(error, '拒绝邀请失败，请稍后重试')
  }
  finally {
    declining.value = false
  }
}

function handleLater() {
  const pages = getCurrentPages()
  if (pages.length > 1)
    uni.navigateBack()
  else
    uni.reLaunch({ url: APP_ROUTES.home })
}

onLoad((options) => {
  params.value = resolveInvitationParams(options)
  void loadInvitation()
})
</script>

<template>
  <AppPage variant="plain" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="邀请" back scroll-mode="sticky" />
    </template>
    <view class="invitation-page box-border min-h-screen bg-surface-page p-5">
      <AppLoading v-if="loading" text="正在读取邀请…" />
      <AppStateCard v-else-if="loadError" class="invitation-load-state" tone="danger" title="无法处理邀请" :description="loadError">
        <template #action>
          <wd-button size="small" variant="plain" @click="loadInvitation">
            重新读取
          </wd-button>
        </template>
      </AppStateCard>

      <view v-else-if="invitation" class="invitation-stack flex flex-col gap-3">
        <view class="invitation-card rounded-4.5 bg-surface-card px-4.5 pb-4.5 pt-6 shadow-app-card">
          <view class="invitation-icon mx-auto my-0 h-14 w-14 flex items-center justify-center rounded-3.5 bg-surface-brand-soft text-size-2xl text-app-brand" :class="invitation.kind === 'organization' ? 'i-carbon-collaborate' : 'i-carbon-home'" />
          <view class="invitation-title mx-0 my-3.5 text-center text-size-base text-content-primary font-bold leading-normal">
            {{ invitation.title }}
          </view>
          <view class="invitation-copy mb-2 text-center text-size-xs text-content-secondary leading-relaxed">
            {{ invitation.kind === 'organization' ? `邀请人：${invitation.senderName || '--'}` : `联系人：${invitation.contactName || '--'}` }}
          </view>
          <view class="invitation-copy mb-2 text-center text-size-xs text-content-secondary leading-relaxed">
            接收账号：{{ invitation.recipientLabel || '--' }}
          </view>
          <view v-if="invitation.expiresAt" class="invitation-copy mb-2 text-center text-size-xs text-content-secondary leading-relaxed">
            有效期至：{{ new Date(invitation.expiresAt).toLocaleString('zh-CN', { hour12: false }) }}
          </view>

          <AppStateCard
            v-if="accepted"
            class="invitation-state"
            tone="success"
            :title="acceptedTitle"
            description="邀请无需再次接受，可以直接进入对应工作空间。"
          />
          <AppStateCard
            v-else-if="invitation.expired"
            class="invitation-state"
            tone="warning"
            title="邀请已过期"
            description="该邀请已超过有效期，请联系邀请人重新发送。"
          />
          <AppStateCard
            v-else
            class="invitation-state"
            tone="info"
            title="待你确认"
            :description="pendingStateDescription"
          />

          <AppStateCard
            v-if="enterError"
            class="invitation-state"
            tone="danger"
            title="进入工作空间失败"
            :description="`${enterError}。请点击下方按钮重试进入，不会重复接受邀请。`"
          />

          <view class="actions mt-4.5 flex flex-col gap-2.5">
            <wd-button
              v-if="!invitation.expired"
              block
              size="large"
              :loading="accepting || entering"
              @click="acceptInvitation"
            >
              {{ accepted ? acceptedActionText : primaryActionText }}
            </wd-button>
            <wd-button v-else block size="large" variant="plain" @click="handleLater">
              返回首页
            </wd-button>
            <wd-button
              v-if="invitation.kind === 'organization' && !accepted && !invitation.expired"
              block
              size="large"
              variant="plain"
              :loading="declining"
              :disabled="accepting"
              @click="declineInvitation"
            >
              拒绝邀请
            </wd-button>
            <wd-button v-else-if="invitation.kind === 'landlord' && !accepted && !invitation.expired" block size="large" variant="text" @click="handleLater">
              稍后处理
            </wd-button>
          </view>
        </view>
        <view class="invitation-note flex gap-2.5 border-hairline border-app-border-brand-soft rounded-3.5 border-solid bg-surface-brand-soft px-3.5 py-3">
          <view /><view><strong>登录要求</strong><text>{{ pendingStateDescription }}</text></view>
        </view>
        <view class="invitation-note flex gap-2.5 border-hairline border-app-border-brand-soft rounded-3.5 border-solid bg-surface-brand-soft px-3.5 py-3">
          <view /><view><strong>房东邀请差异</strong><text>房东邀请只建立委托关系，不提供拒绝操作，可选择稍后处理。</text></view>
        </view>
      </view>
    </view>
  </AppPage>
</template>

<style scoped>
.invitation-load-state {
  @apply max-w-85;
  margin: 18vh auto 0;
}

.invitation-state {
  @apply mt-3.5;
}
.invitation-note > view:first-child {
  @apply w-1 flex-none basis-1 rounded-full bg-app-brand;
}
.invitation-note > view:last-child {
  @apply flex flex-col gap-1;
}
.invitation-note strong {
  @apply text-content-primary text-size-xs;
}
.invitation-note text {
  @apply text-content-secondary text-size-2xs leading-relaxed;
}
</style>
