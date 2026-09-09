<script setup lang="ts">
import type { MediaFileOut, RealNameLogOut, RealNameVerificationOut } from '@/features/account/service'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getRealNameAction, getRealNameStatusLabel, getRealNameTone } from '@/domain/personal-account'
import { getRealNameLogs, getRealNameStatus, retryRealName, submitRealName, uploadRealNameIdCard } from '@/features/account/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '实名认证' } })

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
  <view class="account-page">
    <AppLoading v-if="loading && !status" text="正在加载实名认证状态…" />
    <AppErrorView v-else-if="loadError && !status" :message="loadError" @retry="loadRealName" />
    <template v-else-if="status">
      <view class="status-card">
        <view class="status-topline">
          <view>
            <view class="status-title">
              实名认证
            </view>
            <view class="status-copy">
              {{ status.real_name_masked || '尚未提交实名资料' }}
            </view>
          </view>
          <wd-tag :type="statusTone" variant="light">
            {{ getRealNameStatusLabel(status.status, status.status__mapping || status.status_label) }}
          </wd-tag>
        </view>
        <view v-if="status.id_number_masked" class="status-meta">
          证件：{{ status.id_number_masked }}
        </view>
        <view v-if="status.failure_reason || status.review_note" class="status-reason">
          {{ status.failure_reason || status.review_note }}
        </view>
      </view>

      <view v-if="action" class="form-card">
        <wd-input v-model="realName" label="真实姓名" clearable placeholder="请输入真实姓名" />
        <wd-input v-model="idNumber" label="身份证号" type="idcard" clearable placeholder="请输入身份证号" />
        <view class="upload-grid">
          <view v-for="side in (['front', 'back'] as const)" :key="side" class="upload-card" @click="uploadSide(side)">
            <image v-if="selectionFor(side)?.url" class="id-card-image" :src="selectionFor(side)?.url" mode="aspectFill" />
            <view v-else class="upload-placeholder">
              <view class="i-carbon-cloud-upload upload-icon" /><text>{{ sideLabel(side) }}</text>
            </view>
            <wd-button size="mini" variant="plain" :loading="uploadingSide === side">
              {{ selectionFor(side) ? '重新上传' : '选择图片' }}
            </wd-button>
          </view>
        </view>
        <wd-button block size="large" :loading="submitting" @click="submit">
          {{ action === 'retry' ? '重新提交' : '提交实名' }}
        </wd-button>
      </view>

      <view v-else-if="status.id_card_media?.length" class="preview-card">
        <view class="section-title">
          证件资料
        </view>
        <view class="upload-grid">
          <view v-for="item in status.id_card_media" :key="`${item.side}-${item.media_id}`" class="upload-card readonly">
            <image class="id-card-image" :src="item.thumbnail || item.url || ''" mode="aspectFill" />
            <text>{{ sideLabel(item.side) }}</text>
          </view>
        </view>
      </view>

      <view class="section-title">
        认证记录
      </view>
      <view v-if="logs.length" class="log-list">
        <view v-for="(item, index) in logs" :key="`${item.created_at}-${index}`" class="log-card">
          <view class="log-topline">
            <strong>{{ item.action__mapping || item.action_label }}</strong><text>{{ formatDateTime(item.created_at) }}</text>
          </view>
          <view v-if="item.note" class="log-note">
            {{ item.note }}
          </view>
        </view>
      </view>
      <view v-else class="empty-card">
        暂无认证记录
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.account-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.status-card,
.form-card,
.preview-card,
.log-card,
.empty-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.status-topline,
.log-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}
.status-title {
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.status-copy,
.status-meta,
.log-topline text,
.log-note {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.status-copy {
  margin-top: 8rpx;
}
.status-meta,
.status-reason {
  margin-top: 18rpx;
}
.status-reason {
  padding: 18rpx;
  border-radius: 16rpx;
  color: var(--app-color-danger);
  background: var(--app-bg-subtle);
  font-size: 23rpx;
}
.form-card,
.preview-card {
  margin-top: 22rpx;
}
.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin: 24rpx 0;
}
.upload-card {
  display: flex;
  min-height: 210rpx;
  padding: 16rpx;
  border: 1px dashed var(--app-border-color);
  border-radius: 20rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.upload-card.readonly {
  border-style: solid;
}
.id-card-image {
  width: 100%;
  height: 150rpx;
  border-radius: 14rpx;
}
.upload-placeholder {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10rpx;
}
.upload-icon {
  color: var(--app-color-primary);
  font-size: 46rpx;
}
.section-title {
  margin: 32rpx 8rpx 16rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  font-weight: 600;
}
.log-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.log-topline strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.log-note {
  margin-top: 12rpx;
  line-height: 1.6;
}
.empty-card {
  color: var(--app-text-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
