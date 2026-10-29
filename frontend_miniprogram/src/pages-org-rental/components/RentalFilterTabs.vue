<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  options: ReadonlyArray<{ value: string, label: string }>
  label?: string
}>(), { label: '状态筛选' })
const emit = defineEmits<{ 'update:modelValue': [value: string], 'change': [value: string] }>()
function select({ name }: { name: string | number }) {
  const value = String(name)
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <view role="group" :aria-label="label">
    <wd-tabs :model-value="modelValue" slidable="always" @change="select">
      <wd-tab v-for="item in options" :key="item.value" :name="item.value" :title="item.label" />
    </wd-tabs>
  </view>
</template>
