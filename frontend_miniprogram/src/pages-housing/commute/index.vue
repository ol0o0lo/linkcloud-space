<script setup lang="ts">
import type { AppliedCommute, CommuteDraft } from '@/features/houses/commute'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import CommutePicker from '@/features/houses/commute/CommutePicker.vue'
import { saveCommuteDestination } from '@/features/houses/commute'
import { useWorkPlacePreferenceStore } from '@/features/houses/commute/preference'
import { APP_ROUTES } from '@/modules/routes'

definePage({
  style: { navigationBarTitleText: '通勤找房', navigationStyle: 'custom' },
})

interface OpenerPage {
  getOpenerEventChannel?: () => { emit: (event: string, value: AppliedCommute) => void }
}

const draft = ref<CommuteDraft>({ place: null, mode: 'metro', maxMinutes: 45 })
const workPlacePreference = useWorkPlacePreferenceStore()
const submitting = ref(false)
const returnToSearch = ref(false)
const canSubmit = computed(() => Boolean(draft.value.place) && !submitting.value)

async function submit() {
  if (!draft.value.place || submitting.value)
    return
  submitting.value = true
  try {
    const selection = draft.value
    const destinationId = selection.place.destinationId || (await saveCommuteDestination(selection.place.token)).destination_id
    const applied: AppliedCommute = { ...selection, place: selection.place, destinationId }
    workPlacePreference.save({ ...selection.place, destinationId }, selection.mode)
    if (returnToSearch.value) {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1] as unknown as OpenerPage | undefined
      currentPage?.getOpenerEventChannel?.().emit('applyCommute', applied)
      uni.navigateBack()
      return
    }
    const params = [
      `commute_destination_id=${applied.destinationId}`,
      `commute_place=${encodeURIComponent(applied.place.name)}`,
      `commute_city=${encodeURIComponent(applied.place.city)}`,
      `commute_mode=${encodeURIComponent(applied.mode)}`,
      `commute_max_minutes=${applied.maxMinutes}`,
    ]
    uni.redirectTo({ url: `${APP_ROUTES.publicHouseSearch}?${params.join('&')}` })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '搜索失败，请稍后重试', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

onLoad((options) => {
  returnToSearch.value = options?.from === 'house-search'
  if (workPlacePreference.preference) {
    draft.value = { ...draft.value, place: workPlacePreference.preference.place, mode: workPlacePreference.preference.mode }
  }
})
</script>

<template>
  <AppPage variant="form" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="通勤找房" back scroll-mode="sticky" />
    </template>

    <view class="commute-hero mx-0 mb-3.5 mt-1 rounded-3.5 p-4.5 text-hex-fff">
      <view class="i-carbon-location-star commute-hero__icon text-size-xl" />
      <view class="commute-hero__title mt-1.5 text-size-lg font-bold">
        住得近一点，生活多一点
      </view>
      <view class="commute-hero__subtitle mt-1 text-size-xs opacity-90">
        选一个常去的地方，用通勤时间筛选房源
      </view>
    </view>

    <view class="commute-section mb-3 border-hairline border-app-card rounded-3.5 border-solid bg-surface-card p-3.5">
      <CommutePicker v-model="draft" />
    </view>

    <wd-button block :loading="submitting" :disabled="!canSubmit" @click="submit">
      应用通勤条件
    </wd-button>
  </AppPage>
</template>

<style scoped lang="scss">
.commute-hero {
  background: linear-gradient(130deg, #1669dc, #54a7fc);
}
</style>
