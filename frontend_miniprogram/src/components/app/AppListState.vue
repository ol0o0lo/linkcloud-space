<script setup lang="ts">
import AppEmpty from './AppEmpty.vue'
import AppErrorView from './AppErrorView.vue'
import AppLoading from './AppLoading.vue'

withDefaults(defineProps<{
  loading: boolean
  hasItems: boolean
  finished: boolean
  errorMessage?: string
  loadingText?: string
  emptyText?: string
  emptyDescription?: string
  emptyIcon?: string
  emptyActionText?: string
  emptyCompact?: boolean
  finishedText?: string
  retryText?: string
}>(), {
  errorMessage: '',
  loadingText: '正在加载…',
  emptyText: '暂无内容',
  emptyDescription: '',
  emptyIcon: 'no-content',
  emptyActionText: '',
  emptyCompact: false,
  finishedText: '已经到底了',
  retryText: '重新加载',
})

defineEmits<{
  retry: []
  emptyAction: []
}>()
</script>

<template>
  <AppLoading v-if="loading && !hasItems" :text="loadingText" />
  <AppErrorView
    v-else-if="errorMessage && !hasItems"
    :message="errorMessage"
    :retry-text="retryText"
    @retry="$emit('retry')"
  />
  <AppEmpty
    v-else-if="!hasItems"
    :title="emptyText"
    :description="emptyDescription"
    :icon="emptyIcon"
    :action-text="emptyActionText"
    :compact="emptyCompact"
    @action="$emit('emptyAction')"
  />
  <wd-loadmore
    v-else
    :state="errorMessage ? 'error' : (finished ? 'finished' : 'loading')"
    :loading-text="loadingText"
    :finished-text="finishedText"
    :error-text="errorMessage"
    @reload="$emit('retry')"
  />
</template>
