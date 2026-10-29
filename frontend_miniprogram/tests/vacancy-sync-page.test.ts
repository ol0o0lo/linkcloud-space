import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { compileFunction } from 'node:vm'

const require = createRequire(import.meta.url)
const { compileScript, parse } = require('@vue/compiler-sfc')
const { transpileModule, ModuleKind } = require('typescript')
const vue = require('vue')
const { AppError } = require('../src/core/errors/app-error.ts')

const source = readFileSync(new URL('../src/pages-org-rental/vacancy-sync/index.vue', import.meta.url), 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'vacancy-sync-test' }).content
const compiled = transpileModule(script, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText

function previewResult() {
  return {
    applied: false,
    can_apply: true,
    plan_hash: 'plan-one',
    summary: { buildings: 1, create_buildings: 0, create_houses: 0, update_houses: 1, mark_paused: 0, mark_rented: 0, preserve_ignored: 0 },
    blocks: [],
    errors: [],
  }
}

function createPage() {
  const context = vue.reactive({ organizationSlug: 'alpha' })
  const calls: any[] = []
  const api = {
    previewVacancySync: async (...args: any[]) => {
      calls.push(['preview', ...args])
      return previewResult()
    },
    applyVacancySync: async (...args: any[]) => {
      calls.push(['apply', ...args])
      return { ...previewResult(), applied: true }
    },
  }
  const uni = {
    showToast() {},
    pageScrollTo() {},
    showModal: async (_options: unknown) => ({ confirm: true, content: '101单间1300' }),
  }
  const modules: Record<string, unknown> = {
    'vue': vue,
    '@/store/app-context-v2': { useAppContextStore: () => context },
    '@/pages-org-rental/api/organization-rental': api,
    '@/pages-org-rental/domain/organization-rental': require('../src/pages-org-rental/domain/organization-rental.ts'),
    '@/pages-org-rental/domain/vacancy-sync': require('../src/pages-org-rental/domain/vacancy-sync.ts'),
    '@/domain/house': require('../src/domain/house.ts'),
    '@/core/errors/app-error': { AppError },
    '@/modules/routes': require('../src/modules/routes.ts'),
    '@/hooks/usePagedPage': { usePagedPage: () => ({ reset() {}, refresh() {} }) },
  }
  const module = { exports: {} as any }
  const scope = vue.effectScope()
  const load = compileFunction(compiled, ['require', 'module', 'exports', 'definePage', 'uni'])
  load((name: string) => {
    if (name.endsWith('.vue'))
      return {}
    assert.ok(name in modules, `未模拟的依赖：${name}`)
    return modules[name]
  }, module, module.exports, () => {}, uni)
  const page = scope.run(() => module.exports.default.setup({}, { expose() {} }))
  return { page, api, context, calls, uni, stop: () => scope.stop() }
}

test('预览请求期间锁定原文和重复预览，返回后才恢复', async (t) => {
  const session = createPage()
  t.after(session.stop)
  const { page, api, calls } = session
  let finish!: (result: unknown) => void
  api.previewVacancySync = (...args: any[]) => {
    calls.push(['preview', ...args])
    return new Promise((resolve) => {
      finish = resolve
    }) as any
  }
  page.updateRawText('测试路1号\n101单间1200')
  const pending = page.preview()
  assert.equal(page.busy.value, true)
  page.updateRawText('不应覆盖')
  await page.preview()
  assert.equal(calls.length, 1)
  assert.equal(page.rawText.value, '测试路1号\n101单间1200')
  finish(previewResult())
  await pending
  assert.equal(page.busy.value, false)
  assert.equal(page.canApply.value, true)
})

test('忽略和取消忽略都重新提交完整输入', async (t) => {
  const session = createPage()
  t.after(session.stop)
  const { page, calls } = session
  page.updateRawText('测试路1号\n101单间1200\n101单间1300')
  await page.preview()
  page.updateIgnoredLine(3, { value: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls.at(-1)[2].ignored_lines, [3])
  page.updateIgnoredLine(3, { value: false })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls.at(-1)[2].ignored_lines, [])
  assert.equal(page.previewStale.value, false)
})

test('同步冲突后不能重放旧计划，重新预览后才允许执行', async (t) => {
  const session = createPage()
  t.after(session.stop)
  const { page, api, calls } = session
  page.updateRawText('测试路1号\n101单间1200')
  await page.preview()
  api.applyVacancySync = async (...args: any[]) => {
    calls.push(['apply', ...args])
    throw new AppError({ kind: 'conflict', message: '计划过期' })
  }
  await page.applySync()
  assert.equal(page.canApply.value, false)
  assert.equal(page.previewStale.value, true)
  await page.applySync()
  assert.equal(calls.filter(call => call[0] === 'apply').length, 1)
  await page.preview()
  assert.equal(page.canApply.value, true)
  assert.equal(page.requestError.value, '')
})

test('确认同步期间锁定输入，并使用弹窗前已核对的计划提交', async (t) => {
  const session = createPage()
  t.after(session.stop)
  const { page, uni, calls } = session
  page.updateRawText('测试路1号\n101单间1200')
  await page.preview()
  let confirm!: (value: any) => void
  uni.showModal = () => new Promise((resolve) => {
    confirm = resolve
  }) as any
  const pending = page.applySync()
  page.updateRawText('不应覆盖')
  await page.applySync()
  assert.equal(page.confirming.value, true)
  confirm({ confirm: true })
  await pending
  const applyCalls = calls.filter(call => call[0] === 'apply')
  assert.equal(applyCalls.length, 1)
  assert.equal(applyCalls[0][2].raw_text, '测试路1号\n101单间1200')
  assert.equal(applyCalls[0][2].plan_hash, 'plan-one')
  assert.equal(page.result.value.applied, true)
  page.updateRawText('另一栋\n201单间1400')
  assert.equal(page.result.value, null)
})

test('切换工作空间后，迟到的旧预览不能恢复到新空间', async (t) => {
  const session = createPage()
  t.after(session.stop)
  const { page, api, context } = session
  let finish!: (result: unknown) => void
  api.previewVacancySync = () => new Promise((resolve) => {
    finish = resolve
  }) as any
  page.updateRawText('测试路1号\n101单间1200')
  const pending = page.preview()
  context.organizationSlug = 'beta'
  await vue.nextTick()
  finish(previewResult())
  await pending
  assert.equal(page.result.value, null)
  assert.equal(page.rawText.value, '')
  assert.equal(page.canApply.value, false)
})
