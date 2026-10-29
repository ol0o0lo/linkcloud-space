<script setup lang="ts">
import type { PickedFile } from '@/platform/contracts/file-picker'
import type { MigrationBatch, MigrationOptions } from '@/services/manual/data-migration'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES } from '@/modules/routes'
import { platform } from '@/platform'
import { getMigrationOptions, listMigrationBatches, uploadMigrationPackage } from '@/services/manual/data-migration'
import { useWorkspaceStore } from '@/store/workspace'
import MigrationProgress from './components/MigrationProgress.vue'

definePage({ style: { navigationBarTitleText: '数据迁移', navigationStyle: 'custom', enablePullDownRefresh: true } })

const workspace = useWorkspaceStore()
const toast = useToast()
const options = ref<MigrationOptions | null>(null)
const selectedFile = ref<PickedFile | null>(null)
const loading = ref(false)
const error = ref('')
const uploading = ref(false)
const uploadProgress = ref(0)
let loadedSlug = ''
let generation = 0
const batches = usePagedPage<MigrationBatch>({
  loader: ({ page, pageSize }) => listMigrationBatches(loadedSlug, page, pageSize),
  enabled: () => Boolean(options.value),
  refreshOnShow: false,
  pullDownRefresh: false,
  keyOf: item => item.id,
})

async function load() {
  const slug = workspace.organizationSlug
  const currentGeneration = ++generation
  if (loadedSlug !== slug) {
    options.value = null
    selectedFile.value = null
    batches.reset()
  }
  loadedSlug = slug
  loading.value = true
  error.value = ''
  try {
    const result = await getMigrationOptions(slug)
    if (currentGeneration !== generation || slug !== workspace.organizationSlug)
      return
    options.value = result
    await batches.refresh()
  }
  catch (cause) {
    if (currentGeneration === generation)
      error.value = cause instanceof Error ? cause.message : '迁移信息加载失败'
  }
  finally {
    if (currentGeneration === generation)
      loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function chooseFile() {
  try {
    const selection = await platform.filePicker.pick({ kind: 'file', count: 1, extensions: ['zip'] })
    if ('reason' in selection) {
      toast.warning(selection.reason)
      return
    }
    selectedFile.value = selection.value[0] || null
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '文件选择失败') }
}

function openBatch(batch: MigrationBatch) {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminDataMigrationDetail}?id=${encodeURIComponent(batch.id)}` })
}
function openArchives() {
  uni.navigateTo({ url: APP_ROUTES.organizationAdminMigrationArchives })
}

async function upload() {
  if (uploading.value || !selectedFile.value || !options.value?.can_manage)
    return
  const slug = loadedSlug
  if (slug !== workspace.organizationSlug)
    return
  uploading.value = true
  uploadProgress.value = 0
  try {
    const result = await uploadMigrationPackage(slug, selectedFile.value, value => uploadProgress.value = value)
    if (slug !== workspace.organizationSlug)
      return
    selectedFile.value = null
    openBatch(result)
  }
  catch (cause) { toast.error(cause instanceof Error ? cause.message : '上传失败，可重新上传或刷新任务列表核对') }
  finally { uploading.value = false }
}

onShow(() => void load())
onPullDownRefresh(load)
</script>

<template>
  <AppPage variant="list" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="数据迁移" back :fallback-url="APP_ROUTES.organizationAdmin" scroll-mode="sticky" />
    </template>
    <AppErrorView v-if="error" :message="error" @retry="load" />
    <template v-else>
      <view class="migration-card mb-3 flex flex-col gap-3 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-4">
        <text class="migration-kicker text-size-2xs text-app-brand-active">从旧版 Uhome 导入</text>
        <strong class="migration-title">{{ options?.organization.name || workspace.currentOrganization?.name || '正在获取工作空间' }}</strong>
        <text class="migration-hint text-size-xs text-content-muted leading-relaxed">上传旧版导出的 ZIP 迁移包，先预检，再确认导入。图片与视频由服务器后台迁移。</text>
        <template v-if="options?.can_manage">
          <text class="migration-hint text-size-xs text-content-muted leading-relaxed">推荐使用空组织。已有资料会先核对冲突，不会因上传文件直接写入业务数据。</text>
          <wd-button variant="plain" block :disabled="uploading" @click="chooseFile">
            {{ selectedFile ? '重新选择 ZIP 文件' : '选择 ZIP 迁移包' }}
          </wd-button>
          <text v-if="selectedFile" class="migration-file text-size-xs text-content-primary">{{ selectedFile.name }} · {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MiB</text>
          <wd-progress v-if="uploading" :percentage="uploadProgress" :duration="0" />
          <wd-button v-if="selectedFile" block :loading="uploading" @click="upload">
            上传并预检
          </wd-button>
          <text class="migration-hint text-size-xs text-content-muted leading-relaxed">支持最大 100 MiB 的 ZIP 文件。小程序可从微信会话选择文件；大包和较多补全项建议在电脑 H5 页面操作。</text>
        </template>
        <text v-else-if="options" class="migration-hint text-size-xs text-content-muted leading-relaxed">仅工作空间所有者可以上传和确认导入。</text>
        <wd-button variant="text" @click="openArchives">
          查看历史档案
        </wd-button>
      </view>
      <view class="migration-heading mx-0 mb-2.5 mt-4 flex items-center justify-between">
        <strong>迁移任务</strong><wd-button size="small" variant="text" :loading="loading" @click="load">
          刷新
        </wd-button>
      </view>
      <AppPagedList :items="batches.items.value" :loading="loading || batches.loading.value" :loading-more="batches.loadingMore.value" :finished="batches.finished.value" :error="batches.error.value" empty-text="暂无迁移任务" @retry="batches.refresh">
        <template #item="{ item }">
          <view class="migration-card mb-3 flex flex-col app-touchable gap-3 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-4" @click="openBatch(item)">
            <strong>{{ item.source_team_name || '来源团队待解析' }}</strong>
            <text class="migration-hint text-size-xs text-content-muted leading-relaxed">{{ item.created_at.replace('T', ' ').slice(0, 16) }} · 查看详情 ›</text>
            <MigrationProgress :batch="item" />
            <text v-if="item.error_message" class="migration-error text-size-xs">{{ item.error_message }}</text>
          </view>
        </template>
      </AppPagedList>
    </template>
    <wd-toast />
  </AppPage>
</template>

<style scoped>
.migration-title {
  @apply text-size-lg text-content-primary;
}
.migration-file {
  overflow-wrap: anywhere;
}
.migration-error {
  color: var(--app-color-danger, #d94a4a);
  overflow-wrap: anywhere;
}
</style>
