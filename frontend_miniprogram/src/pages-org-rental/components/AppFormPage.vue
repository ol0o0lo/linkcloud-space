<script setup lang="ts">
import type { AppError } from '@/core/errors/app-error'
import { useSlots } from 'vue'
import AppActionBar from '@/components/app/AppActionBar.vue'
import AppAsyncContent from '@/components/app/AppAsyncContent.vue'
import AppPage from '@/components/app/AppPage.vue'

withDefaults(defineProps<{
  loading?: boolean
  error?: AppError | string | null
  loadingText?: string
  errorTitle?: string
  retryable?: boolean
  submitting?: boolean
  submitText?: string
  submitDisabled?: boolean
  showActions?: boolean
  reserveActionSpace?: boolean
}>(), {
  loading: false,
  error: null,
  loadingText: '正在加载…',
  errorTitle: '加载失败',
  retryable: true,
  submitting: false,
  submitText: '保存',
  submitDisabled: false,
  showActions: true,
  reserveActionSpace: true,
})

const emit = defineEmits<{
  retry: []
  submit: []
}>()

const slots = useSlots()
</script>

<template>
  <AppPage variant="form" gutter="none" :reserve-footer-space="showActions && !loading && !error && reserveActionSpace">
    <template #navigation>
      <slot name="navigation" />
    </template>
    <template #header>
      <slot name="header" />
    </template>
    <template #before>
      <slot name="feedback" />
    </template>
    <AppAsyncContent
      :loading="loading"
      :error="error"
      :loading-text="loadingText"
      :error-title="errorTitle"
      :retryable="retryable"
      @retry="emit('retry')"
    >
      <view class="flex flex-col gap-2.5 py-3">
        <slot />
      </view>
    </AppAsyncContent>
    <template v-if="showActions && !loading && !error" #footer>
      <slot name="before-actions" />
      <AppActionBar :placeholder="reserveActionSpace">
        <slot name="actions">
          <wd-button block :loading="submitting" :disabled="submitDisabled" @click="emit('submit')">
            {{ submitText }}
          </wd-button>
        </slot>
      </AppActionBar>
    </template>
    <template v-if="slots.overlay" #overlay>
      <slot name="overlay" />
    </template>
  </AppPage>
</template>
