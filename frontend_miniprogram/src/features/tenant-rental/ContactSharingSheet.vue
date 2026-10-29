<script setup lang="ts">
import type { Conversation, MessagingMessage } from '@/features/messaging/types'
import type { TenantContactChannel } from '@/services/manual/tenant-rental'
import { onHide } from '@dcloudio/uni-app'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import { conversationTitle } from '@/features/messaging/context'
import { readPersonalContact, sharePersonalContact, updatePersonalContact } from '@/services/manual/tenant-rental'
import { useWorkspaceStore } from '@/store/workspace'
import { canShareContact, createContactSharingController, emptyContactSharingState } from './contact-sharing'

const props = defineProps<{ visible: boolean, conversation: Conversation }>()
const emit = defineEmits<{ 'update:visible': [value: boolean], 'sent': [message: MessagingMessage] }>()
const workspace = useWorkspaceStore()
const state = shallowRef(emptyContactSharingState())
const controller = createContactSharingController(
  { read: readPersonalContact, save: updatePersonalContact, share: sharePersonalContact },
  () => workspace.user?.id || null,
  value => state.value = value,
  (message) => {
    emit('update:visible', false)
    emit('sent', message)
  },
)
const enabled = computed(() => canShareContact(state.value) && props.conversation.can_send)
const description = computed(() => `发给 ${conversationTitle(props.conversation)} · ${props.conversation.organization.name}`)
const buttonText = computed(() => {
  const channels = state.value.channels
  return channels.length === 2 ? '发送联系方式' : channels.includes('phone') ? '发送手机号' : channels.includes('wechat') ? '发送微信号' : '选择要发送的信息'
})
const fields: { key: TenantContactChannel, label: string, icon: string }[] = [
  { key: 'phone', label: '手机号', icon: 'i-carbon-phone' },
  { key: 'wechat', label: '微信号', icon: 'i-carbon-chat' },
]

function load() {
  if (workspace.user?.id)
    void controller.open(workspace.user.id, props.conversation.id)
}

watch(() => props.visible, (visible) => {
  if (visible)
    load()
  else
    void controller.save()
}, { immediate: true })
watch([() => workspace.user?.id, () => props.conversation.id], () => {
  controller.reset()
  emit('update:visible', false)
}, { flush: 'sync' })
onHide(() => {
  void controller.save()
  emit('update:visible', false)
})
onScopeDispose(controller.reset)
</script>

<template>
  <AppBottomSheet
    :visible="visible"
    title="分享联系方式"
    :description="description"
    :z-index="1200"
    :scrollable="false"
    :footer-divider="false"
    show-handle
    custom-style="--wot-popup-radius:24px;--wot-popup-close-margin:24px;--wot-popup-close-size:18px"
    @update:visible="emit('update:visible', $event)"
  >
    <view class="contact-sharing">
      <view v-if="state.loading" class="contact-sharing__loading px-0 py-3 text-size-xs leading-5">
        正在读取联系方式…
      </view>
      <view v-else-if="state.loaded" class="contact-sharing__list rounded-3.5 px-3.5 py-0">
        <view
          v-for="field in fields"
          :key="field.key"
          class="contact-sharing__row min-h-20 flex items-center gap-3"
          @click="controller.select(field.key, !state.channels.includes(field.key))"
        >
          <view class="contact-sharing__icon h-8.5 w-8.5 flex shrink-0 items-center justify-center rounded-2.5 text-size-lg" :class="{ 'contact-sharing__icon--selected': state.channels.includes(field.key) }">
            <text :class="field.icon" />
          </view>
          <view class="contact-sharing__value min-w-0 flex-1 px-0 py-3.5" @click.stop>
            <text class="contact-sharing__label mb-1 block text-size-xs">{{ field.label }}</text>
            <wd-input
              :model-value="state.values[field.key]"
              :type="field.key === 'phone' ? 'tel' : 'text'"
              :inputmode="field.key === 'phone' ? 'tel' : 'text'"
              :placeholder="`填写${field.label}`"
              :maxlength="field.key === 'phone' ? 32 : 64"
              :disabled="state.sending"
              :cursor-spacing="48"
              custom-style="background:transparent;--wot-input-padding:0;--wot-input-inner-font-size:18px;--wot-input-inner-color:#344b65"
              placeholder-style="font-size:14px;color:#a5afbc;font-weight:400"
              @update:model-value="controller.edit(field.key, String($event))"
              @blur="controller.save()"
            />
          </view>
          <view class="contact-sharing__check min-h-11 min-w-8 flex items-center justify-center" @click.stop>
            <wd-checkbox
              :model-value="state.channels.includes(field.key)"
              :disabled="state.sending"
              :aria-label="`发送${field.label}`"
              custom-style="--wot-checkbox-icon-size:20px;--wot-checkbox-label-margin:0"
              @change="controller.select(field.key, Boolean($event.value))"
            />
          </view>
        </view>
      </view>
      <view v-if="state.error" class="contact-sharing__error px-0 py-3 text-size-xs leading-5" role="alert">
        {{ state.error }}<text v-if="!state.loaded" @click="load"> · 点击重试</text>
      </view>
    </view>
    <template #footer>
      <view class="contact-sharing__privacy mx-0 mb-3.5 mt-1.5 flex items-center justify-center gap-1.5 text-size-2xs leading-4.5">
        <text class="i-carbon-information" />
        <text>选中的信息会发到聊天中，对方可查看并保存</text>
      </view>
      <wd-button block :loading="state.sending" :disabled="!enabled" @click="controller.send()">
        {{ buttonText }}
      </wd-button>
    </template>
  </AppBottomSheet>
</template>

<style scoped lang="scss">
.contact-sharing__list {
  background: #f7f8fa;
}
.contact-sharing__row + .contact-sharing__row {
  border-top: 1px solid #e8ecf1;
}
.contact-sharing__icon {
  color: #7990a8;
  background: #eaf0f7;
}
.contact-sharing__icon--selected {
  color: #5485bf;
  background: #e5effd;
}
.contact-sharing__label {
  color: #8b98a8;
}
.contact-sharing__privacy {
  color: #8d9baa;
}
.contact-sharing__loading {
  color: #8b98a8;
}
.contact-sharing__error {
  color: #c85555;
}
</style>
