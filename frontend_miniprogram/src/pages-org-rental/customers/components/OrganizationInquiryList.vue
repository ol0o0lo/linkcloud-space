<script setup lang="ts">
import type { OrganizationInquiry } from '@/services/manual/rental-closure'
import { computed, ref, watch } from 'vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import RentalFilterTabs from '../../components/RentalFilterTabs.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES } from '@/modules/routes'
import { formatMerchantTime } from '@/domain/merchant-presentation'
import { formatPhoneDisplay } from '@/domain/phone'
import { formatOrganizationHouseTitle } from '@/pages-org-rental/domain/organization-rental'
import { listOrganizationInquiries } from '@/services/manual/rental-closure'
import { useAppContextStore } from '@/store/app-context-v2'

const props = defineProps<{ initialStatus?: string, contactId?: number }>()
const context = useAppContextStore()
const keyword = ref('')
const status = ref(props.initialStatus || '')
const statuses = [{ value: '', label: '全部' }, { value: 'new', label: '待处理' }, { value: 'processing', label: '处理中' }, { value: 'signed', label: '已签约' }, { value: 'closed', label: '已关闭' }]
const hasFilters = computed(() => Boolean(keyword.value.trim() || status.value))
const list = usePagedPage<OrganizationInquiry>({
  keyOf: item => item.id,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  loader: ({ page, pageSize }) => listOrganizationInquiries(context.organizationSlug, page, pageSize, { keyword: keyword.value.trim() || undefined, status: status.value || undefined, contact_id: props.contactId }),
})
watch(() => [context.organizationSlug, props.contactId, props.initialStatus], () => {
  status.value = props.initialStatus || ''
  list.reset()
  void list.refresh()
}, { immediate: true })
defineExpose({ refresh: list.refresh, loadMore: list.loadMore })
function open(id: number) {
  uni.navigateTo({ url: `${APP_ROUTES.organizationInquiryDetail}?id=${id}` })
}

function resetFilters() {
  keyword.value = ''
  status.value = ''
  void list.refresh()
}
</script>

<template>
  <view>
    <view class="overflow-hidden rounded-app-lg bg-surface-card">
      <wd-search v-model="keyword" variant="filled" placeholder="搜索客户、手机号或房源" placeholder-left hide-cancel @search="list.refresh" @clear="list.refresh" />
      <RentalFilterTabs v-model="status" :options="statuses" label="咨询状态" @change="list.refresh" />
    </view>
    <view class="min-h-10 flex items-center justify-between gap-2 text-[12px] text-content-secondary">
      <text>{{ status ? `${statuses.find(option => option.value === status)?.label}咨询` : '全部咨询' }} · {{ list.loaded.value ? `共 ${list.total.value} 条` : '正在加载…' }}</text>
      <wd-button v-if="hasFilters" size="small" variant="text" @click="resetFilters">
        清除筛选
      </wd-button>
    </view>
    <AppPagedList :items="list.items.value" :loading="list.loading.value" :refreshing="list.refreshing.value" :loading-more="list.loadingMore.value" :finished="list.finished.value" :error="list.error.value" :empty-text="hasFilters ? '没有符合条件的咨询' : '暂无客户咨询'" :empty-description="hasFilters ? '试试清空关键词或切换咨询状态。' : '租客提交咨询后会在这里显示，可直接安排带看或登记签约。'" :empty-action-text="hasFilters ? '清除筛选' : ''" finished-text="没有更多咨询了" @retry="list.refresh" @empty-action="resetFilters">
      <template #item="{ item }">
        <AppRecordCard variant="compact" clickable @click="open(item.id)">
          <template #header>
            <view class="flex items-center justify-between gap-2">
              <view class="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <strong class="max-w-full truncate text-[16px] text-content-primary">{{ item.customer_name || '咨询客户' }}</strong>
                <text class="text-[12px] text-content-secondary">{{ formatPhoneDisplay(item.phone) || (item.wechat ? `微信：${item.wechat}` : '未留联系方式') }}</text>
              </view>
              <wd-tag variant="light" size="medium" :type="item.status === 'signed' ? 'success' : item.status === 'closed' ? 'default' : 'primary'">
                {{ statuses.find(option => option.value === item.status)?.label || item.status_label }}
              </wd-tag>
            </view>
          </template>
          <view class="mt-1 flex items-start gap-1.5 text-[14px] text-content-secondary leading-snug">
            <view class="i-carbon-home mt-0.5 shrink-0 text-content-muted" />
            <text class="line-clamp-2 min-w-0">{{ item.house ? formatOrganizationHouseTitle(item.house) : '原咨询房源已不可用' }}</text>
          </view>
          <template #footer>
            <view class="text-[12px] text-content-secondary leading-normal">
              <view>负责人：{{ item.assigned_to_name || '未分配' }} · 带看 {{ item.viewing_count }} 次</view>
              <view class="mt-1">
                {{ formatMerchantTime(item.created_at) }}
              </view>
            </view>
          </template>
          <template #actions>
            <wd-button size="small" :variant="item.status === 'new' || item.status === 'processing' ? 'base' : 'text'" @click.stop="open(item.id)">
              {{ item.status === 'new' || item.status === 'processing' ? '处理咨询' : '查看记录' }}
            </wd-button>
          </template>
        </AppRecordCard>
      </template>
    </AppPagedList>
    <wd-button v-if="!list.finished.value && list.items.value.length" block variant="text" :loading="list.loadingMore.value" @click="list.loadMore">
      加载更多咨询
    </wd-button>
  </view>
</template>
