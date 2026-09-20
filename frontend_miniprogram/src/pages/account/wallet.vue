<script setup lang="ts">
import type { WalletLedgerOut, WalletSummaryOut, WithdrawalOut } from '@/features/account/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { createWithdrawalRequestId, formatWalletAmount, getWalletEntryTypeLabel, getWithdrawalActions, getWithdrawalPayChannelLabel, getWithdrawalStatusLabel, validateWithdrawalAmount } from '@/domain/personal-account'
import { cancelWithdrawal, createWithdrawal, getWalletLedger, getWalletSummary, getWithdrawals } from '@/features/account/service'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({ style: { navigationBarTitleText: '我的钱包', navigationStyle: 'custom', enablePullDownRefresh: true } })

const summary = ref<WalletSummaryOut | null>(null)
const pageSize = 20
const activeTab = ref<'ledger' | 'withdrawals'>('ledger')
const amount = ref<string | number>('')
const loading = ref(false)
const submitting = ref(false)
const cancelingId = ref<number | null>(null)
const loadError = ref('')

const ledgerPage = usePagedPage<WalletLedgerOut>({
  loader: ({ page, pageSize: targetPageSize }) => getWalletLedger(page, targetPageSize),
  pageSize,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const withdrawalPage = usePagedPage<WithdrawalOut>({
  loader: ({ page, pageSize: targetPageSize }) => getWithdrawals(page, targetPageSize),
  pageSize,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function refreshData() {
  loading.value = true
  loadError.value = ''
  try {
    const [nextSummary] = await Promise.all([
      getWalletSummary(),
      ledgerPage.refresh(),
      withdrawalPage.refresh(),
    ])
    summary.value = nextSummary
  }
  catch {
    loadError.value = '钱包数据加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadMore() {
  await (activeTab.value === 'ledger' ? ledgerPage.loadMore() : withdrawalPage.loadMore())
}

async function submitWithdrawal() {
  const value = Number(amount.value)
  const message = validateWithdrawalAmount(value, summary.value?.available_balance || 0)
  if (message) {
    uni.showToast({ title: message, icon: 'none' })
    return
  }
  const confirmation = await uni.showModal({ title: '提交微信提现', content: `确认申请提现 ${formatWalletAmount(value)} 吗？`, confirmText: '确认提交' })
  if (!confirmation.confirm)
    return
  submitting.value = true
  try {
    await createWithdrawal({
      amount: value,
      fee_amount: 0,
      pay_channel: 'wechat',
      payee_account: {},
      client_request_id: createWithdrawalRequestId(),
    })
    amount.value = ''
    await refreshData()
    activeTab.value = 'withdrawals'
    uni.showToast({ title: '提现申请已提交', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '提现申请失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

async function cancel(item: WithdrawalOut) {
  const confirmation = await uni.showModal({ title: '撤销提现', content: '仅待审核申请可以撤销，撤销后冻结金额将退回可用余额。', confirmText: '确认撤销' })
  if (!confirmation.confirm)
    return
  cancelingId.value = item.id
  try {
    await cancelWithdrawal(item.id)
    await refreshData()
    uni.showToast({ title: '提现申请已撤销', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '撤销失败', icon: 'none' })
  }
  finally {
    cancelingId.value = null
  }
}

function switchTab(tab: 'ledger' | 'withdrawals') {
  activeTab.value = tab
}

onShow(() => void refreshData())
onPullDownRefresh(refreshData)
onReachBottom(() => void loadMore())
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation title="我的钱包" back scroll-mode="sticky" />
    </template>
    <view v-if="summary" class="wallet-hero app-card p-4">
      <view class="text-xs">
        可用余额
      </view>
      <view class="mt-1 text-3xl font-bold">
        {{ formatWalletAmount(summary.available_balance) }}
      </view>
      <view class="grid grid-cols-3 mt-3.5 gap-1.5">
        <view class="flex flex-col gap-1">
          <strong class="text-sm">{{ formatWalletAmount(summary.frozen_balance) }}</strong><text class="text-2xs">冻结余额</text>
        </view>
        <view class="flex flex-col gap-1">
          <strong class="text-sm">{{ formatWalletAmount(summary.total_income) }}</strong><text class="text-2xs">累计收入</text>
        </view>
        <view class="flex flex-col gap-1">
          <strong class="text-sm">{{ formatWalletAmount(summary.total_withdrawn) }}</strong><text class="text-2xs">累计提现</text>
        </view>
      </view>
    </view>

    <view class="mt-2.5 app-card p-3.5">
      <view class="text-base text-content-primary font-bold">
        微信提现
      </view>
      <view class="mb-2 mt-1 text-xs text-content-muted leading-relaxed">
        提现将使用当前账号已绑定的微信身份，提交后进入后台审核。
      </view>
      <wd-input v-model="amount" label="提现金额" type="number" clearable placeholder="请输入整数金额" />
      <wd-button block :loading="submitting" @click="submitWithdrawal">
        提交提现申请
      </wd-button>
    </view>

    <view class="grid grid-cols-2 mb-2 mt-3.5 gap-1.5 rounded-app-md bg-surface-subtle p-1">
      <view class="app-touchable rounded-app-md px-1.5 py-2 text-center text-xs" :class="activeTab === 'ledger' ? 'bg-surface-card text-app-brand font-semibold' : 'text-content-muted'" @click="switchTab('ledger')">
        资金流水（{{ ledgerPage.total.value }}）
      </view>
      <view class="app-touchable rounded-app-md px-1.5 py-2 text-center text-xs" :class="activeTab === 'withdrawals' ? 'bg-surface-card text-app-brand font-semibold' : 'text-content-muted'" @click="switchTab('withdrawals')">
        提现记录（{{ withdrawalPage.total.value }}）
      </view>
    </view>

    <AppPagedList
      v-if="activeTab === 'ledger'"
      :items="ledgerPage.items.value"
      item-key="id"
      :loading="loading || ledgerPage.loading.value"
      :refreshing="ledgerPage.refreshing.value"
      :loading-more="ledgerPage.loadingMore.value"
      :finished="ledgerPage.finished.value"
      :error="ledgerPage.error.value || loadError"
      loading-text="正在加载钱包数据…"
      empty-text="暂无资金流水"
      finished-text="没有更多记录了"
      @retry="refreshData"
    >
      <template #item="{ item }">
        <AppRecordCard>
          <template #title>
            {{ getWalletEntryTypeLabel(item.entry_type, item.entry_type__mapping) }}
          </template>
          <template #status>
            <text class="text-sm font-semibold" :class="item.amount_delta > 0 ? 'text-app-success' : 'text-app-danger'">{{ item.amount_delta > 0 ? '+' : '' }}{{ formatWalletAmount(item.amount_delta) }}</text>
          </template>
          <template #meta>
            余额 {{ formatWalletAmount(item.available_balance_after) }} · {{ formatDateTime(item.created_at) }}
          </template>
          <template v-if="item.remark" #description>
            {{ item.remark }}
          </template>
        </AppRecordCard>
      </template>
    </AppPagedList>
    <AppPagedList
      v-else
      :items="withdrawalPage.items.value"
      item-key="id"
      :loading="loading || withdrawalPage.loading.value"
      :refreshing="withdrawalPage.refreshing.value"
      :loading-more="withdrawalPage.loadingMore.value"
      :finished="withdrawalPage.finished.value"
      :error="withdrawalPage.error.value || loadError"
      loading-text="正在加载钱包数据…"
      empty-text="暂无提现记录"
      finished-text="没有更多记录了"
      @retry="refreshData"
    >
      <template #item="{ item }">
        <AppRecordCard>
          <template #title>
            提现 {{ formatWalletAmount(item.amount) }}
          </template>
          <template #status>
            <wd-tag variant="light" size="small">
              {{ getWithdrawalStatusLabel(item.status, item.status__mapping) }}
            </wd-tag>
          </template>
          <template #description>
            到账 {{ formatWalletAmount(item.net_amount) }} · {{ getWithdrawalPayChannelLabel(item.pay_channel, item.pay_channel__mapping) }}
            <view v-if="item.reject_reason" class="mt-1.5 text-app-danger">
              {{ item.reject_reason }}
            </view>
          </template>
          <template #footer>
            {{ formatDateTime(item.created_at) }}
          </template>
          <template v-if="getWithdrawalActions(item.status).includes('cancel')" #actions>
            <wd-button size="mini" type="danger" variant="plain" :loading="cancelingId === item.id" @click="cancel(item)">
              撤销
            </wd-button>
          </template>
        </AppRecordCard>
      </template>
    </AppPagedList>
  </AppPage>
</template>

<style scoped lang="scss">
.wallet-hero {
  min-height: 340rpx;
  border-radius: 40rpx;
  color: #fff;
  background: var(--app-gradient-personal);
  box-shadow: var(--app-shadow-hero-personal);
}
.wallet-hero text,
.wallet-hero strong,
.wallet-hero view {
  color: inherit;
}
</style>
