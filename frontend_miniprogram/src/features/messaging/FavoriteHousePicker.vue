<script setup lang="ts">
import type { FavoriteOut } from '@/features/favorites/service'
import { computed, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { buildFavoriteHouseCardModel } from '@/domain/house-card'
import { listHouseFavorites } from '@/features/favorites/service'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useWorkspaceStore } from '@/store/workspace'

const props = defineProps<{ visible: boolean, conversationId: number }>()
const emit = defineEmits<{ 'update:visible': [value: boolean], 'select': [favorite: FavoriteOut] }>()
const workspace = useWorkspaceStore()
const selectedId = ref<number | null>(null)
const favorites = usePagedPage<FavoriteOut>({
  loader: ({ page, pageSize }) => listHouseFavorites(page, pageSize),
  enabled: () => props.visible && workspace.authenticated,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const selected = computed(() => favorites.items.value.find(item => item.id === selectedId.value && item.available && item.target_type === 'house'))

watch(() => [props.visible, props.conversationId, workspace.user?.id] as const, () => {
  selectedId.value = null
  favorites.reset()
  if (props.visible)
    void favorites.refresh()
}, { immediate: true })
onHide(() => emit('update:visible', false))

function send() {
  if (selected.value)
    emit('select', selected.value)
}
</script>

<template>
  <AppBottomSheet :visible="visible" title="发送收藏房源" description="选择一套房源，发送到当前聊天" :scrollable="false" show-handle @update:visible="emit('update:visible', $event)">
    <scroll-view class="favorite-house-picker" scroll-y @scrolltolower="favorites.loadMore()">
      <AppPagedList :items="favorites.items.value" item-key="id" :loading="favorites.loading.value" :loading-more="favorites.loadingMore.value" :finished="favorites.finished.value" :error="favorites.error.value" empty-text="还没有收藏房源" empty-description="收藏房源后，可在这里选择并发送。" finished-text="没有更多收藏了" @retry="favorites.refresh">
        <template #item="{ item }">
          <HouseCard :card="buildFavoriteHouseCardModel(item)" variant="compact" selectable :selected="item.id === selectedId" :disabled="!item.available || item.target_type !== 'house'" @click="selectedId = item.id" />
        </template>
      </AppPagedList>
    </scroll-view>
    <template #footer>
      <wd-button block :disabled="!selected" @click="send">
        发送房源
      </wd-button>
    </template>
  </AppBottomSheet>
</template>

<style scoped>
.favorite-house-picker {
  height: 48vh;
}
</style>
