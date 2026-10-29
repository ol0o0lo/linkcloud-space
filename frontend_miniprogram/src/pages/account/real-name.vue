<script setup lang="ts">
import type { MediaFileOut, RealNameLogOut, RealNameVerificationOut } from '@/features/account/service'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getRealNameAction, getRealNameStatusLabel, getRealNameTone } from '@/domain/personal-account'
import { getRealNameLogs, getRealNameStatus, retryRealName, submitRealName, uploadRealNameIdCard } from '@/features/account/service'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '实名认证', navigationStyle: 'custom' } })

type IdCardSide = 'front' | 'back'
interface IdCardSelection {
  media_id: number
  media_type: 'image'
  side: IdCardSide
  url: string
}

const appContextStore = useAppContextStore()
const status = ref<RealNameVerificationOut | null>(null)
const logs = ref<RealNameLogOut[]>([])
const realName = ref('')
const idNumber = ref('')
const idCardMedia = ref<IdCardSelection[]>([])
const loading = ref(false)
const uploadingSide = ref<IdCardSide | null>(null)
const submitting = ref(false)
const loadError = ref('')

const action = computed(() => getRealNameAction(status.value?.status))
const statusTone = computed(() => getRealNameTone(status.value?.status))

function sideLabel(side: IdCardSide) {
  return side === 'front' ? '身份证人像面' : '身份证国徽面'
}

function existingSelection(item: NonNullable<RealNameVerificationOut['id_card_media']>[number]): IdCardSelection | null {
  if (item.side !== 'front' && item.side !== 'back')
    return null
  return {
    media_id: item.media_id,
    media_type: 'image',
    side: item.side,
    url: item.thumbnail || item.url || '',
  }
}

function setExistingMedia(result: RealNameVerificationOut) {
  if (getRealNameAction(result.status) !== 'retry') {
    idCardMedia.value = []
    return
  }
  idCardMedia.value = (result.id_card_media || []).map(existingSelection).filter((item): item is IdCardSelection => Boolean(item))
}

async function loadRealName() {
  loading.value = true
  loadError.value = ''
  try {
    const [nextStatus, nextLogs] = await Promise.all([getRealNameStatus(), getRealNameLogs()])
    status.value = nextStatus
    logs.value = nextLogs
    setExistingMedia(nextStatus)
  }
  catch {
    loadError.value = '实名认证状态加载失败，请稍后重试'
  }
  finally {
    loading.value = false
  }
}

function selectionFor(side: IdCardSide) {
  return idCardMedia.value.find(item => item.side === side)
}

async function uploadSide(side: IdCardSide) {
  uploadingSide.value = side
  try {
    const media: MediaFileOut | undefined = await uploadRealNameIdCard()
    if (!media)
      throw new Error('上传结果为空')
    const selection: IdCardSelection = { media_id: media.id, media_type: 'image', side, url: media.thumbnail || media.url }
    idCardMedia.value = [...idCardMedia.value.filter(item => item.side !== side), selection]
    uni.showToast({ title: `${sideLabel(side)}已上传`, icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '身份证图片上传失败', icon: 'none' })
  }
  finally {
    uploadingSide.value = null
  }
}

async function submit() {
  if (!action.value)
    return
  if (!appContextStore.user?.phone_verified) {
    uni.showToast({ title: '请先完成手机号验证', icon: 'none' })
    return
  }
  if (!realName.value.trim() || !idNumber.value.trim()) {
    uni.showToast({ title: '请填写真实姓名和身份证号', icon: 'none' })
    return
  }
  const front = selectionFor('front')
  const back = selectionFor('back')
  if (!front || !back) {
    uni.showToast({ title: '请上传身份证人像面和国徽面', icon: 'none' })
    return
  }
  const payload = {
    real_name: realName.value.trim(),
    id_number: idNumber.value.trim(),
    id_card_media: [front, back].map(({ media_id, media_type, side }) => ({ media_id, media_type, side })),
    source: 'user_submit',
  }
  const currentAction = action.value
  submitting.value = true
  try {
    if (currentAction === 'retry')
      await retryRealName(payload)
    else
      await submitRealName(payload)
    realName.value = ''
    idNumber.value = ''
    await appContextStore.refreshAuthenticatedContext()
    await loadRealName()
    uni.showToast({ title: currentAction === 'retry' ? '实名认证已重新提交' : '实名认证已提交', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '实名认证提交失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

onShow(() => void loadRealName())
</script>

<template>
  <AppPage variant="form" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="实名认证" back scroll-mode="sticky" />
    </template>
    <view class="account-page box-border min-h-screen bg-surface-page px-5 pb-9 pt-5">
      <AppLoading v-if="loading && !status" text="正在加载实名认证状态…" />
      <AppErrorView v-else-if="loadError && !status" :message="loadError" @retry="loadRealName" />
      <template v-else-if="status">
        <view class="status-card border-hairline border-app-border-brand-soft rounded-4 border-solid p-3.5" :class="`status-card--${statusTone}`">
          <view class="status-topline flex items-start justify-between gap-2.5">
            <view>
              <view class="status-title text-size-base text-content-primary font-bold">
                认证状态
              </view>
              <view class="status-copy mt-1">
                {{ status.real_name_masked || '尚未提交实名资料' }}
              </view>
            </view>
            <wd-tag :type="statusTone" variant="light">
              {{ getRealNameStatusLabel(status.status, status.status__mapping || status.status_label) }}
            </wd-tag>
          </view>
          <view v-if="status.id_number_masked" class="status-meta mt-2.5">
            证件：{{ status.id_number_masked }}
          </view>
          <view v-if="status.failure_reason || status.review_note" class="status-reason mt-2.5 rounded-2 bg-surface-subtle p-2.5 text-size-xs text-app-danger">
            {{ status.failure_reason || status.review_note }}
          </view>
        </view>

        <view v-if="action" class="form-card mt-3.5 flex flex-col gap-3 rounded-4 p-3.5">
          <wd-input v-model="realName" label="真实姓名" clearable placeholder="请输入真实姓名" />
          <wd-input v-model="idNumber" label="身份证号" type="idcard" clearable placeholder="请输入身份证号" />
          <view class="section-title section-title--inside font-semibold">
            身份证照片
          </view>
          <view class="upload-grid grid grid-cols-2 mx-0 my-3 gap-2.5">
            <view v-for="side in (['front', 'back'] as const)" :key="side" class="upload-card min-h-26 flex flex-col items-center justify-center gap-2 rounded-2.5 p-2 text-size-2xs text-content-muted" @click="uploadSide(side)">
              <image v-if="selectionFor(side)?.url" class="id-card-image h-19 w-full rounded-2" :src="selectionFor(side)?.url" mode="aspectFill" />
              <view v-else class="upload-placeholder flex flex-col items-center gap-1.5">
                <view class="i-carbon-cloud-upload upload-icon text-size-2xl text-app-brand" /><text>{{ sideLabel(side) }}</text>
              </view>
              <wd-button size="mini" variant="plain" :loading="uploadingSide === side">
                {{ selectionFor(side) ? '重新上传' : '选择图片' }}
              </wd-button>
            </view>
          </view>
          <wd-button block size="large" :loading="submitting" @click="submit">
            {{ action === 'retry' ? '重新提交' : '提交实名认证' }}
          </wd-button>
        </view>

        <AppNotice
          v-if="action"
          class="prerequisite-notice"
          :tone="appContextStore.user?.phone_verified ? 'success' : 'warning'"
          :title="appContextStore.user?.phone_verified ? '可以提交实名资料' : '请先验证手机号'"
          :description="appContextStore.user?.phone_verified ? '手机号已验证，填写并上传证件资料后即可提交。' : '未验证手机号时无法提交实名资料，请先在账号设置中完成验证。'"
          compact
        />

        <view v-else-if="status.id_card_media?.length" class="preview-card mt-3.5 rounded-4 p-3.5">
          <view class="section-title font-semibold">
            证件资料
          </view>
          <view class="upload-grid grid grid-cols-2 mx-0 my-3 gap-2.5">
            <view v-for="item in status.id_card_media" :key="`${item.side}-${item.media_id}`" class="upload-card readonly min-h-26 flex flex-col items-center justify-center gap-2 rounded-2.5 p-2 text-size-2xs text-content-muted">
              <image class="id-card-image h-19 w-full rounded-2" :src="item.thumbnail || item.url || ''" mode="aspectFill" />
              <text>{{ sideLabel(item.side) }}</text>
            </view>
          </view>
        </view>

        <view class="section-title font-semibold">
          认证记录
        </view>
        <view v-if="logs.length" class="log-list flex flex-col gap-2">
          <view v-for="(item, index) in logs" :key="`${item.created_at}-${index}`" class="log-card rounded-4 p-3.5">
            <view class="log-topline flex items-start justify-between gap-2.5">
              <strong>{{ item.action__mapping || item.action_label }}</strong><text>{{ formatDateTime(item.created_at) }}</text>
            </view>
            <view v-if="item.note" class="log-note mt-1.5 leading-relaxed">
              {{ item.note }}
            </view>
          </view>
        </view>
        <view v-else class="empty-card rounded-4 p-3.5 text-center text-size-xs text-content-muted">
          暂无认证记录
        </view>
      </template>
    </view>
  </AppPage>
</template>

<style scoped>
.status-card,
.form-card,
.preview-card,
.log-card,
.empty-card {
  @apply bg-surface-card;
}
.status-card {
  @apply bg-surface-brand-soft;
}
.status-card--warning {
  border-color: #f1d49c;
  background: #fff8eb;
}
.status-card--success {
  border-color: #bfe5d6;
  background: #ecf9f3;
}
.status-card--danger {
  border-color: #f1c7c7;
  background: #fff1f1;
}
.status-copy,
.status-meta,
.log-topline text,
.log-note {
  @apply text-content-muted text-size-xs;
}
:deep(.form-card .wd-input) {
  @apply min-h-13 py-1.5 px-3 border-hairline border-solid border-app-border rounded-3 box-border;
}
.upload-card {
  border: 1px dashed var(--app-border-color);
}
.upload-card.readonly {
  @apply border-solid;
}
.section-title {
  @apply mt-4 mx-1 mb-2 text-content-secondary text-size-xs;
}
.section-title--inside {
  @apply mt-1.5 mx-0 mb-0 text-content-primary text-size-sm;
}
.prerequisite-notice {
  @apply mt-3.5;
}
.log-topline strong {
  @apply text-content-primary text-size-xs;
}
</style>
