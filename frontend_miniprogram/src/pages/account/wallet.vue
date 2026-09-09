<script setup lang="ts">
import type { WalletLedgerOut, WalletSummaryOut, WithdrawalOut } from '@/features/account/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { createWithdrawalRequestId, formatWalletAmount, getWalletEntryTypeLabel, getWithdrawalActions, getWithdrawalPayChannelLabel, getWithdrawalStatusLabel, validateWithdrawalAmount } from '@/domain/personal-account'
import { cancelWithdrawal, createWithdrawal, getWalletLedger, getWalletSummary, getWithdrawals } from '@/features/account/service'
import AppListState from '@/shared/components/AppListState.vue'

definePage({ style: { navigationBarTitleText: '我的钱包', enablePullDownRefresh: true } })

const summary = ref<WalletSummaryOut | null>(null)
const ledger = ref<WalletLedgerOut[]>([])
const withdrawals = ref<WithdrawalOut[]>([])
const ledgerPage = ref(1)
const withdrawalPage = ref(1)
const pageSize = 20
const ledgerTotal = ref(0)
const withdrawalTotal = ref(0)
const activeTab = ref<'ledger' | 'withdrawals'>('ledger')
const amount = ref<string | number>('')
const loading = ref(false)
const submitting = ref(false)
const cancelingId = ref<number | null>(null)
const loadError = ref('')

const activeItemsLength = computed(() => activeTab.value === 'ledger' ? ledger.value.length : withdrawals.value.length)
const activeTotal = computed(() => activeTab.value === 'ledger' ? ledgerTotal.value : withdrawalTotal.value)
const finished = computed(() => activeItemsLength.value >= activeTotal.value && activeTotal.value >= 0)

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

async function loadData(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    ledgerPage.value = 1
    withdrawalPage.value = 1
  }
  loading.value = true
  loadError.value = ''
  try {
    if (reset) {
      const [nextSummary, nextLedger, nextWithdrawals] = await Promise.all([
        getWalletSummary(),
        getWalletLedger(1, pageSize),
        getWithdrawals(1, pageSize),
      ])
      summary.value = nextSummary
      ledger.value = nextLedger.items
      withdrawals.value = nextWithdrawals.items
      ledgerTotal.value = nextLedger.total
      withdrawalTotal.value = nextWithdrawals.total
      ledgerPage.value = nextLedger.items.length < nextLedger.total ? 2 : 1
      withdrawalPage.value = nextWithdrawals.items.length < nextWithdrawals.total ? 2 : 1
    }
    else if (activeTab.value === 'ledger') {
      const result = await getWalletLedger(ledgerPage.value, pageSize)
      ledger.value = [...ledger.value, ...result.items]
      ledgerTotal.value = result.total
      ledgerPage.value += 1
    }
    else {
      const result = await getWithdrawals(withdrawalPage.value, pageSize)
      withdrawals.value = [...withdrawals.value, ...result.items]
      withdrawalTotal.value = result.total
      withdrawalPage.value += 1
    }
  }
  catch {
    loadError.value = '钱包数据加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
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
    await loadData(true)
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
    await loadData(true)
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

onShow(() => void loadData(true))
onPullDownRefresh(() => loadData(true))
onReachBottom(() => void loadData())
</script>

<template>
  <view class="account-page">
    <view v-if="summary" class="summary-card">
      <view class="balance-label">
        可用余额
      </view>
      <view class="balance-value">
        {{ formatWalletAmount(summary.available_balance) }}
      </view>
      <view class="summary-grid">
        <view><strong>{{ formatWalletAmount(summary.frozen_balance) }}</strong><text>冻结余额</text></view>
        <view><strong>{{ formatWalletAmount(summary.total_income) }}</strong><text>累计收入</text></view>
        <view><strong>{{ formatWalletAmount(summary.total_withdrawn) }}</strong><text>累计提现</text></view>
      </view>
    </view>

    <view class="withdraw-card">
      <view class="section-title">
        微信提现
      </view>
      <view class="section-copy">
        提现将使用当前账号已绑定的微信身份，提交后进入后台审核。
      </view>
      <wd-input v-model="amount" label="提现金额" type="number" clearable placeholder="请输入整数金额" />
      <wd-button block :loading="submitting" @click="submitWithdrawal">
        提交提现申请
      </wd-button>
    </view>

    <view class="tabs">
      <view :class="{ active: activeTab === 'ledger' }" @click="switchTab('ledger')">
        资金流水（{{ ledgerTotal }}）
      </view>
      <view :class="{ active: activeTab === 'withdrawals' }" @click="switchTab('withdrawals')">
        提现记录（{{ withdrawalTotal }}）
      </view>
    </view>

    <view v-if="activeTab === 'ledger' && ledger.length" class="record-list">
      <view v-for="item in ledger" :key="item.id" class="record-card">
        <view class="record-topline">
          <strong>{{ getWalletEntryTypeLabel(item.entry_type, item.entry_type__mapping) }}</strong><text :class="{ income: item.amount_delta > 0 }">{{ item.amount_delta > 0 ? '+' : '' }}{{ formatWalletAmount(item.amount_delta) }}</text>
        </view>
        <view class="record-meta">
          余额 {{ formatWalletAmount(item.available_balance_after) }} · {{ formatDateTime(item.created_at) }}
        </view>
        <view v-if="item.remark" class="record-copy">
          {{ item.remark }}
        </view>
      </view>
    </view>
    <view v-else-if="activeTab === 'withdrawals' && withdrawals.length" class="record-list">
      <view v-for="item in withdrawals" :key="item.id" class="record-card">
        <view class="record-topline">
          <strong>提现 {{ formatWalletAmount(item.amount) }}</strong><wd-tag variant="light" size="small">
            {{ getWithdrawalStatusLabel(item.status, item.status__mapping) }}
          </wd-tag>
        </view>
        <view class="record-meta">
          到账 {{ formatWalletAmount(item.net_amount) }} · {{ getWithdrawalPayChannelLabel(item.pay_channel, item.pay_channel__mapping) }}
        </view>
        <view class="record-footer">
          <text>{{ formatDateTime(item.created_at) }}</text><wd-button v-if="getWithdrawalActions(item.status).includes('cancel')" size="mini" type="danger" variant="plain" :loading="cancelingId === item.id" @click="cancel(item)">
            撤销
          </wd-button>
        </view>
        <view v-if="item.reject_reason" class="record-copy danger">
          {{ item.reject_reason }}
        </view>
      </view>
    </view>
    <AppListState :loading="loading" :has-items="activeItemsLength > 0" :finished="finished" :error-message="loadError" loading-text="正在加载钱包数据…" :empty-text="activeTab === 'ledger' ? '暂无资金流水' : '暂无提现记录'" finished-text="没有更多记录了" @retry="loadData(activeItemsLength === 0)" />
  </view>
</template>

<style scoped lang="scss">
.account-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.summary-card,
.withdraw-card,
.record-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.summary-card {
  background: var(--app-gradient-profile);
}
.balance-label,
.section-copy,
.record-meta,
.record-copy,
.record-footer {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.balance-value {
  margin-top: 8rpx;
  color: var(--app-text-primary);
  font-size: 52rpx;
  font-weight: 750;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 28rpx;
}
.summary-grid view {
  display: flex;
  flex-direction: column;
  gap: 7rpx;
}
.summary-grid strong {
  color: var(--app-text-secondary);
  font-size: 26rpx;
}
.summary-grid text {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.withdraw-card {
  margin-top: 22rpx;
}
.section-title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
}
.section-copy {
  margin: 8rpx 0 18rpx;
  line-height: 1.6;
}
.tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10rpx;
  margin: 28rpx 0 18rpx;
  padding: 8rpx;
  border-radius: 20rpx;
  background: var(--app-bg-subtle);
}
.tabs view {
  padding: 18rpx 12rpx;
  border-radius: 15rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
  text-align: center;
}
.tabs view.active {
  color: var(--app-color-primary);
  background: var(--app-bg-card);
  font-weight: 650;
}
.record-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.record-topline,
.record-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.record-topline strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.record-topline text {
  color: var(--app-color-danger);
  font-size: 27rpx;
  font-weight: 650;
}
.record-topline text.income {
  color: var(--app-color-success);
}
.record-meta {
  margin-top: 12rpx;
}
.record-copy {
  margin-top: 12rpx;
  line-height: 1.6;
}
.record-copy.danger {
  color: var(--app-color-danger);
}
.record-footer {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1px solid var(--app-divider-color);
}
</style>
