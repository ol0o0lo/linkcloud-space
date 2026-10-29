<script setup lang="ts">
import type { MessageContentSource } from './message-content'
import { computed } from 'vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { getHouseDetailRoute } from '@/modules/routes'
import { contactCardPayload, houseCardPayload, houseMessageCard } from './message-content'

const props = defineProps<{ message: MessageContentSource, placement: 'left' | 'right' }>()
const contact = computed(() => contactCardPayload(props.message))
const house = computed(() => houseCardPayload(props.message))
const card = computed(() => house.value ? houseMessageCard(house.value, props.message.media) : null)
const structured = computed(() => Boolean(contact.value || card.value))

function copy(value: string) {
  uni.setClipboardData({ data: value })
}

function callPhone() {
  if (contact.value?.phone)
    uni.makePhoneCall({ phoneNumber: contact.value.phone })
}

function openHouse() {
  if (house.value)
    uni.navigateTo({ url: getHouseDetailRoute(house.value.house_id) })
}

function copyMessage() {
  if (!structured.value)
    copy(props.message.content)
}
</script>

<template>
  <t-chat-message role="user" :placement="placement" :content="structured ? [] : [{ type: 'text', data: message.content }]" :variant="structured ? 'text' : 'base'" status="complete" :custom-style="{ marginBottom: '0' }" @message-longpress="copyMessage">
    <template #content>
      <view v-if="contact" class="contact-card box-border max-w-full w-60 overflow-hidden border-hairline border-app-divider rounded-3 border-solid bg-surface-card p-3 text-content-primary">
        <view class="contact-card__heading flex items-center gap-1.5 pb-2.5 text-size-sm text-app-brand font-semibold">
          <t-icon name="user-circle" size="34rpx" /><text>联系方式</text>
        </view>
        <view v-if="contact.phone" class="contact-card__row border-t-hairline border-t-app-divider border-t-solid px-0 pb-1 pt-2.5">
          <text class="contact-card__label mb-1 block text-size-xs text-content-muted">手机号</text>
          <text class="contact-card__value block text-size-sm text-content-primary leading-normal" selectable>{{ contact.phone }}</text>
          <view class="contact-card__actions mt-2 flex flex-wrap gap-2.5">
            <wd-button size="mini" variant="text" @click="callPhone">
              拨打电话
            </wd-button><wd-button size="mini" variant="text" @click="copy(contact.phone)">
              复制号码
            </wd-button>
          </view>
        </view>
        <view v-if="contact.wechat" class="contact-card__row border-t-hairline border-t-app-divider border-t-solid px-0 pb-1 pt-2.5">
          <text class="contact-card__label mb-1 block text-size-xs text-content-muted">微信号</text>
          <text class="contact-card__value block text-size-sm text-content-primary leading-normal" selectable>{{ contact.wechat }}</text>
          <view class="contact-card__actions mt-2 flex flex-wrap gap-2.5">
            <wd-button size="mini" variant="text" @click="copy(contact.wechat)">
              复制微信号
            </wd-button>
          </view>
        </view>
      </view>
      <view v-else-if="card" class="house-message-card box-border max-w-full w-60 overflow-hidden border-hairline border-app-divider rounded-3 border-solid bg-surface-card text-content-primary">
        <HouseCard :card="card" variant="compact" @click="openHouse" /><view class="house-message-card__footer flex items-center gap-1 border-t-hairline border-t-app-divider border-t-solid px-3 py-2 text-size-2xs text-content-muted" @click="openHouse">
          <t-icon name="home" size="22rpx" />房源信息<text class="i-carbon-chevron-right" />
        </view>
      </view>
    </template>
  </t-chat-message>
</template>

<style scoped lang="scss">
.contact-card__value {
  overflow-wrap: anywhere;
}
.house-message-card__footer > text {
  @apply ml-auto;
}
.house-message-card :deep(.house-card) {
  @apply border-0 rounded-0 shadow-none bg-transparent;
}
.house-message-card :deep(.house-card__deposit) {
  @apply hidden;
}
</style>
