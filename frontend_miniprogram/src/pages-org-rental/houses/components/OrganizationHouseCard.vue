<script setup lang="ts">
import type { HouseOut } from '@/pages-org-rental/api/organization-rental'
import HouseCard from '@/components/house/HouseCard.vue'

defineProps<{
  house: HouseOut
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <HouseCard :house="house" action-text="查看" @click="$emit('click')" @action="$emit('click')" />
</template>
