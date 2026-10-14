<script setup lang="ts">
import { ref } from 'vue'
import { getLeaseContractFile } from '@/domain/lease-contract'
import { openLeaseContract } from '@/infra/upload/preview'

defineProps<{ files: Record<string, unknown>[] }>()
const opening = ref(false)
async function open(file: Record<string, unknown>) {
  if (opening.value)
    return
  opening.value = true
  try {
    await openLeaseContract(file)
  }
  catch (error) { uni.showToast({ title: error instanceof Error ? error.message : '附件打开失败，请稍后重试', icon: 'none' }) }
  finally { opening.value = false }
}
</script>

<template>
  <view>
    <wd-cell v-if="!files.length" title="合同文件" value="未上传" />
    <wd-cell v-for="(file, index) in files" :key="String(file.media_id || index)" :title="getLeaseContractFile(file).name" :label="opening ? '正在打开…' : '点击查看或下载'" is-link @click="open(file)" />
  </view>
</template>
