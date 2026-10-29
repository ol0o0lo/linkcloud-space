<script setup lang="ts">
import type { HouseAIInsightOut } from '@/features/houses/service'
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  insight?: HouseAIInsightOut | null
  loading?: boolean
  generating?: boolean
  error?: string
  canGenerate?: boolean
}>(), { insight: null, loading: false, generating: false, error: '', canGenerate: false })
defineEmits<{ generate: [], retry: [] }>()
const expanded = ref(false)
const generatedLabel = computed(() => {
  if (!props.insight?.generated_at)
    return ''
  const date = new Date(props.insight.generated_at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}–${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
})
</script>

<template>
  <view class="detail-card insight-card">
    <view class="detail-heading">
      <view class="insight-heading flex items-center gap-1.5">
        <text class="i-carbon-ai insight-heading-icon text-size-xl text-hex-006bcc" /><text>AI 房源速览</text>
      </view>
      <text class="detail-meta">{{ generatedLabel || '暂无速览' }}</text>
    </view>
    <view v-if="loading" class="insight-copy mx-0 mb-2 mt-1 text-size-xs text-hex-3e5167 leading-5.5">
      正在读取房源速览…
    </view>
    <view v-else-if="error" class="insight-copy mx-0 mb-2 mt-1 text-size-xs text-hex-3e5167 leading-5.5">
      {{ error }}<button class="detail-text-button" @click="$emit('retry')">
        重新加载
      </button>
    </view>
    <template v-else-if="insight?.insight">
      <view class="insight-copy mx-0 mb-2 mt-1 text-size-xs text-hex-3e5167 leading-5.5">
        {{ insight.insight.conclusion.text }}
      </view>
      <view class="signals flex flex-wrap gap-1.5">
        <view v-for="signal in insight.insight.signals" :key="`${signal.label}-${signal.value}`" class="signal flex items-center gap-1 rounded-1 bg-hex-edf4fc px-1.5 py-1 text-size-2xs text-hex-55718e leading-4">
          <text class="signal-icon flex-none text-size-xs" :class="signal.tone === 'positive' ? 'i-carbon-checkmark' : 'i-carbon-information'" /><text>{{ signal.label }}{{ signal.value ? ` · ${signal.value}` : '' }}</text>
        </view>
      </view>
      <view class="insight-foot mt-1.5 min-h-9 flex items-center justify-between gap-2 text-size-2xs text-hex-778a9f">
        <text>{{ insight.source_changed ? '资料已变化 · 建议重新生成' : insight.state === 'expired' ? '速览已过期 · 请核实最新资料' : '依据房源资料 · AI 生成' }}</text>
        <button class="detail-text-button" :aria-expanded="expanded" @click="expanded = !expanded">
          {{ expanded ? '收起速览' : '展开速览' }}<text :class="expanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-right'" />
        </button>
      </view>
      <view v-if="expanded" class="insight-expanded mt-2 border-t-1 border-t-hex-e0ebf6 border-t-solid pt-2.5 text-size-xs text-hex-526177 leading-5.5">
        <text class="insight-label mx-0 mb-1 mt-2 block text-size-xs text-hex-182538 font-semibold">房源亮点</text>
        <view v-for="point in insight.insight.appeal_points" :key="point.text">
          {{ point.text }}
        </view>
        <text class="insight-label mx-0 mb-1 mt-2 block text-size-xs text-hex-182538 font-semibold">看房前问题</text>
        <view v-for="(question, index) in insight.insight.viewing_questions" :key="question.text">
          {{ index + 1 }}. {{ question.text }}
        </view>
        <text class="insight-label mx-0 mb-1 mt-2 block text-size-xs text-hex-182538 font-semibold">内容依据</text>
        <view class="insight-source text-size-2xs text-hex-78869a leading-4.5">
          <text v-for="fact in insight.insight.facts" :key="fact.id">{{ fact.label }}：{{ fact.value }}；</text>
        </view>
        <wd-button v-if="canGenerate" variant="text" size="small" :loading="generating" @click="$emit('generate')">
          <text class="i-carbon-renew" /> 重新生成
        </wd-button>
      </view>
      <wd-button v-else-if="canGenerate && (insight.source_changed || insight.state === 'expired')" variant="text" size="small" :loading="generating" @click="$emit('generate')">
        重新生成
      </wd-button>
    </template>
    <template v-else>
      <view class="insight-copy mx-0 mb-2 mt-1 text-size-xs text-hex-3e5167 leading-5.5">
        {{ canGenerate ? '生成房源速览，快速了解房源亮点和看房前需要确认的问题。' : '当前房源暂无公开速览，可先查看下方房源介绍与资料。' }}
      </view>
      <view class="signals flex flex-wrap gap-1.5">
        <text class="signal flex items-center gap-1 rounded-1 bg-hex-edf4fc px-1.5 py-1 text-size-2xs text-hex-55718e leading-4">综合结论</text><text class="signal flex items-center gap-1 rounded-1 bg-hex-edf4fc px-1.5 py-1 text-size-2xs text-hex-55718e leading-4">房源亮点</text><text class="signal flex items-center gap-1 rounded-1 bg-hex-edf4fc px-1.5 py-1 text-size-2xs text-hex-55718e leading-4">看房问题</text>
      </view>
      <view class="insight-foot mt-1.5 min-h-9 flex items-center justify-between gap-2 text-size-2xs text-hex-778a9f">
        <text>仅依据公开房源资料</text><wd-button v-if="canGenerate" variant="text" size="small" :loading="generating" @click="$emit('generate')">
          生成速览
        </wd-button><text v-else>待更新</text>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.insight-card {
  @apply border-hex-dcebf9;
  background: linear-gradient(110deg, #f4f9ff, #fff);
}
</style>
