<script setup lang="ts">
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { computed } from 'vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { canCancelTenantViewing, formatTenantHouseAddress, formatTenantHouseTitle, getTenantViewingStatusTone } from '@/domain/tenant-rental'

const props = withDefaults(defineProps<{
  record: TenantViewingRecordOut
  canceling?: boolean
  clickable?: boolean
}>(), { canceling: false, clickable: true })
const emit = defineEmits<{ open: [], cancel: [] }>()
const scheduled = computed(() => canCancelTenantViewing(props.record.status))
const address = computed(() => formatTenantHouseAddress(props.record.house))
const overdue = computed(() => scheduled.value && Date.parse(props.record.scheduled_at) < Date.now())

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
}

function contactReceptionist() {
  const phone = props.record.receptionist?.phone
  if (phone)
    uni.makePhoneCall({ phoneNumber: phone })
}

function openLocation() {
  const location = props.record.house.building.location
  if (location) {
    uni.openLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      name: formatTenantHouseTitle(props.record.house),
      address: address.value,
      fail: () => uni.showToast({ title: '位置打开失败，请稍后重试', icon: 'none' }),
    })
  }
  else {
    uni.setClipboardData({ data: address.value })
  }
}
</script>

<template>
  <AppRecordCard :clickable="clickable" :variant="scheduled ? 'prominent' : 'compact'" @click="emit('open')">
    <template #title>
      {{ formatTenantHouseTitle(record.house) }}
    </template>
    <template #status>
      <AppStatusTag :text="scheduled ? '待看房' : record.status__mapping" :tone="getTenantViewingStatusTone(record.status)" />
    </template>
    <view class="mt-2 text-sm text-content-primary font-medium">
      {{ formatTime(record.scheduled_at) }}
    </view>
    <view v-if="scheduled" class="mt-2 text-sm text-content-secondary">
      接待人：{{ record.receptionist?.name || '工作人员待安排' }}
    </view>
    <view v-if="scheduled" class="mt-2 flex items-start gap-1 text-xs text-app-brand" role="button" @click.stop="openLocation">
      <text class="i-carbon-location mt-0.5 shrink-0" />
      <text class="min-w-0 break-words">{{ address }} · {{ record.house.building.location ? '查看位置' : '复制地址' }}</text>
    </view>
    <view v-if="overdue" class="mt-2 text-xs text-app-warning">
      看房时间已过，等待工作人员更新结果
    </view>
    <view v-if="!scheduled && record.viewed_at" class="mt-2 text-xs text-content-muted">
      实际带看：{{ formatTime(record.viewed_at) }}
    </view>
    <template #description>
      {{ record.organization.name }}
    </template>
    <template v-if="clickable" #footer>
      <text class="text-xs text-app-brand">查看详情</text>
    </template>
    <template v-if="scheduled" #actions>
      <wd-button size="mini" variant="plain" :disabled="!record.receptionist?.phone" @click.stop="contactReceptionist">
        {{ record.receptionist?.phone ? '联系接待人' : '暂无联系电话' }}
      </wd-button>
      <wd-button size="mini" type="info" variant="text" :loading="canceling" :disabled="canceling" @click.stop="emit('cancel')">
        取消预约
      </wd-button>
    </template>
  </AppRecordCard>
</template>
