import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function readSource(relativePath: string) {
  return readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8')
}

test('统一空状态支持说明、图标、紧凑布局和主要操作', () => {
  const empty = readSource('components/app/AppEmpty.vue')
  const pagedList = readSource('components/app/AppPagedList.vue')

  for (const prop of ['description', 'iconSize', 'actionText', 'compact'])
    assert.match(empty, new RegExp(`${prop}\\??:`))
  assert.match(empty, /#bottom/)
  assert.match(empty, /emit\('action'\)|\$emit\('action'\)/)

  for (const prop of ['emptyDescription', 'emptyIcon', 'emptyActionText', 'emptyCompact'])
    assert.match(pagedList, new RegExp(`${prop}\\??:`))
  assert.match(pagedList, /emptyAction/)
  assert.match(pagedList, /<AppEmpty/)
})

test('统一提示组件覆盖常用语义状态和可选操作', () => {
  const notice = readSource('components/app/AppNotice.vue')
  const stateCard = readSource('components/app/AppStateCard.vue')

  assert.match(notice, /'info' \| 'success' \| 'warning' \| 'danger'/)
  assert.match(notice, /actionText\?: string/)
  assert.match(notice, /app-notice--compact/)
  assert.match(stateCard, /<AppNotice/)
})

test('收藏页仅在存在下架收藏时显示说明，空页面引导继续找房', () => {
  const favorites = readSource('pages/favorites/index.vue')

  assert.match(favorites, /unavailableFavoriteCount/)
  assert.match(favorites, /v-if="unavailableFavoriteCount(?: > 0)?"/)
  assert.match(favorites, /empty-action-text="去找房"/)
  assert.match(favorites, /empty-icon="no-collection"/)
  assert.match(favorites, /<HouseCard/)
  assert.doesNotMatch(favorites, /class="favorite-card/)
  assert.doesNotMatch(favorites, />\s*取消收藏\s*</)
  assert.doesNotMatch(favorites, /收藏同步/)
  assert.doesNotMatch(favorites, /offline-note/)
})

test('任务页区分筛选无结果、等待分配和可创建任务', () => {
  const tasks = readSource('pages-org-work/tasks/index.vue')

  assert.match(tasks, /hasTaskFilters/)
  assert.match(tasks, /新任务分配给你后会显示在这里/)
  assert.match(tasks, /canManageTasks\.value[\s\S]*创建任务并分配执行人/)
  assert.match(tasks, /@empty-action="clearTaskFilters"/)
  assert.match(tasks, /@empty-action="handleTeamEmptyAction"/)
})
