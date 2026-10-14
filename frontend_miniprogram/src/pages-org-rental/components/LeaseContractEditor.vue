<script setup lang="ts">
import { ref } from 'vue'
import LeaseContractFiles from '@/components/house/LeaseContractFiles.vue'
import { uploadOrganizationLeaseContract } from '@/pages-org-rental/api/organization-rental'

const props = withDefaults(defineProps<{ files: Record<string, unknown>[], disabled?: boolean, organizationSlug: string }>(), { disabled: false })
const emit = defineEmits<{ 'update:files': [files: Record<string, unknown>[]], 'uploading': [value: boolean] }>()
const uploading = ref(false)
function showError(error: unknown) {
  uni.showToast({ title: error instanceof Error ? error.message : '附件上传失败，请稍后重试', icon: 'none' })
}
async function upload() {
  if (uploading.value || props.disabled)
    return
  uploading.value = true
  emit('uploading', true)
  try {
    const files = await uploadOrganizationLeaseContract(props.organizationSlug)
    if (files.length)
      emit('update:files', files.map(file => ({ ...file, media_id: file.id, media_type: 'file' })))
  }
  catch (error) { showError(error) }
  finally {
    uploading.value = false
    emit('uploading', false)
  }
}
async function remove(index: number) {
  if (props.disabled || uploading.value)
    return
  const result = await uni.showModal({ title: '移除合同附件', content: '保存租约后生效，原文件会保留。', confirmText: '移除' })
  if (result.confirm)
    emit('update:files', props.files.filter((_, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <view>
    <LeaseContractFiles :files="files" />
    <view class="px-3 py-2">
      <wd-button size="small" variant="plain" :loading="uploading" :disabled="disabled" @click="upload">
        {{ files.length ? '替换合同' : '上传合同' }}
      </wd-button>
      <wd-button v-for="(file, index) in files" :key="String(file.media_id || index)" class="ml-2" size="small" variant="plain" type="danger" :disabled="disabled || uploading" @click="remove(index)">
        移除{{ files.length > 1 ? `第 ${index + 1} 份` : '' }}
      </wd-button>
      <view class="mt-2 text-xs text-content-muted">
        支持 PDF、DOC、DOCX，最多一份，单文件不超过 10 MB；保存租约后生效。
      </view>
    </view>
  </view>
</template>
