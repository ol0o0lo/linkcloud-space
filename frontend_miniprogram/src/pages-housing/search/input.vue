<script setup lang="ts">
import type { PublicHouseSuggestion } from '@/features/houses/service'
import { onLoad, onReady, onUnload } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { getPublicHouseSuggestions } from '@/features/houses/service'
import { APP_ROUTES } from '@/modules/routes'

definePage({
  style: { navigationBarTitleText: '搜索房源', navigationStyle: 'custom' },
})

interface OpenerPage {
  getOpenerEventChannel?: () => { emit: (event: string, value: string) => void }
}

const keyword = ref('')
const city = ref('')
const inputFocused = ref(false)
const returnToResults = ref(false)
const suggestions = ref<PublicHouseSuggestion[]>([])
const loading = ref(false)
const error = ref(false)
const term = computed(() => keyword.value.trim())
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchVersion = 0

watch(keyword, (value) => {
  clearTimeout(searchTimer)
  const version = ++searchVersion
  suggestions.value = []
  error.value = false
  const nextTerm = value.trim()
  if (!nextTerm) {
    loading.value = false
    return
  }
  loading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const result = await getPublicHouseSuggestions(nextTerm, city.value || undefined)
      if (version === searchVersion)
        suggestions.value = result
    }
    catch {
      if (version === searchVersion)
        error.value = true
    }
    finally {
      if (version === searchVersion)
        loading.value = false
    }
  }, 250)
})

function submitSearch(value = keyword.value) {
  const selectedKeyword = value.trim()
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as unknown as OpenerPage | undefined
  const channel = currentPage?.getOpenerEventChannel?.()
  uni.hideKeyboard()
  if (returnToResults.value && channel) {
    channel.emit('applyKeyword', selectedKeyword)
    uni.navigateBack()
    return
  }
  uni.redirectTo({ url: `${APP_ROUTES.publicHouseSearch}?keyword=${encodeURIComponent(selectedKeyword)}` })
}

onLoad((options) => {
  returnToResults.value = options?.from === 'house-search'
  city.value = String(options?.city || '')
  keyword.value = String(options?.keyword || '')
})

onReady(() => inputFocused.value = true)

onUnload(() => {
  searchVersion += 1
  clearTimeout(searchTimer)
})
</script>

<template>
  <AppPage class="house-keyword-page">
    <template #navigation>
      <AppCustomNavigation title="" align="start" back scroll-mode="sticky" :fallback-url="APP_ROUTES.publicHouseSearch">
        <template #content>
          <view class="keyword-navigation">
            <view class="keyword-search-bar">
              <view class="i-carbon-search keyword-search-icon" />
              <view class="keyword-search-input">
                <wd-input v-model="keyword" compact :focus="inputFocused" placeholder="搜索小区、区域或房源" clearable confirm-type="search" @confirm="submitSearch()" />
              </view>
            </view>
            <button class="keyword-search-submit" @click="submitSearch()">
              搜索
            </button>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <view v-if="!term" class="keyword-search-hint">
      输入小区、商圈、区域或房号开始搜索
    </view>
    <view v-else class="keyword-suggestions">
      <view class="keyword-suggestions__heading">
        搜索联想
      </view>
      <view v-if="loading" class="keyword-suggestions__status">
        正在查找…
      </view>
      <view v-else-if="error" class="keyword-suggestions__status">
        联想词加载失败，请继续输入或直接搜索
      </view>
      <view v-else-if="!suggestions.length" class="keyword-suggestions__status">
        暂无相关搜索词，按搜索键试试
      </view>
      <button v-for="item in suggestions" v-else :key="`${item.category}-${item.keyword}`" class="keyword-suggestions__item" @click="submitSearch(item.keyword)">
        <view class="i-carbon-search keyword-suggestions__icon" />
        <view class="keyword-suggestions__copy">
          <text class="keyword-suggestions__keyword">{{ item.keyword }}</text>
          <text class="keyword-suggestions__meta">{{ item.category }} · {{ item.house_count }} 套房源</text>
        </view>
        <view class="i-carbon-arrow-up-right keyword-suggestions__arrow" />
      </button>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.house-keyword-page {
  min-height: 100vh;
  background: #fff;
}
.keyword-navigation {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
}
.keyword-search-bar {
  display: flex;
  height: 64rpx;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10rpx;
  padding: 0 16rpx;
  border: 1rpx solid rgb(22 119 255 / 10%);
  border-radius: 34rpx;
  box-sizing: border-box;
  background: #f3f7fd;
}
.keyword-search-icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 32rpx;
}
.keyword-search-input {
  min-width: 0;
  flex: 1;
}
:deep(.keyword-search-input .wd-input) {
  padding: 0;
  background: transparent;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 60rpx;
  --wot-input-inner-font-size: 24rpx;
  --wot-input-padding: 0;
}
.keyword-search-submit {
  flex: 0 0 auto;
  margin: 0;
  padding: 0 2rpx;
  color: var(--app-color-brand);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 64rpx;
  background: transparent;
}
.keyword-search-submit::after,
.keyword-suggestions__item::after {
  border: 0;
}
.keyword-search-hint {
  padding: 22rpx 4rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.keyword-suggestions {
  margin-top: 4rpx;
}
.keyword-suggestions__heading {
  padding-bottom: 12rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  font-weight: 600;
}
.keyword-suggestions__status {
  padding: 28rpx 0;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.keyword-suggestions__item {
  display: flex;
  width: 100%;
  min-height: 108rpx;
  align-items: center;
  gap: 18rpx;
  margin: 0;
  padding: 18rpx 4rpx;
  border-bottom: 1rpx solid var(--app-border-color);
  border-radius: 0;
  text-align: left;
  background: transparent;
}
.keyword-suggestions__icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 30rpx;
}
.keyword-suggestions__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}
.keyword-suggestions__keyword {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.keyword-suggestions__meta {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.keyword-suggestions__arrow {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 25rpx;
}
</style>
