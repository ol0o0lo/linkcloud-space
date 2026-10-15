import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { computed, effectScope, reactive, ref, watch } from 'vue'

const source = readFileSync(new URL('../src/features/account/useRealNameStatus.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function setup() {
  const context = reactive<{ user: { id: number, real_name_status: string } | null }>({ user: { id: 1, real_name_status: 'pending' } })
  const requests: Array<{ resolve: (value: { status: string }) => void, reject: (reason: Error) => void }> = []
  const scope = effectScope()
  const useStatus = runInNewContext(`${compiled}\nexports.useRealNameStatus`, {
    exports: {},
    require(name: string) {
      if (name === 'vue')
        return { computed, ref, watch }
      if (name === '@dcloudio/uni-app')
        return { onShow() {} }
      if (name === './service')
        return { getRealNameStatus: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) }
      if (name === '@/store/app-context-v2')
        return { useAppContextStore: () => context }
      throw new Error(`未知测试依赖：${name}`)
    },
  })
  const state = scope.run(() => useStatus())
  return { context, requests, scope, state }
}

test('认证刷新按最新请求生效，刷新失败保留当前账号最近结果', async () => {
  const { context, requests, scope, state } = setup()
  try {
    const first = state.refresh()
    const second = state.refresh()
    requests[1].resolve({ status: 'verified' })
    await second
    requests[0].resolve({ status: 'rejected' })
    await first
    assert.equal(state.status.value, 'verified')

    const failed = state.refresh()
    assert.equal(state.status.value, 'verified')
    requests[2].reject(new Error('网络异常'))
    await failed
    assert.equal(state.status.value, 'verified')

    context.user!.real_name_status = 'manual_review'
    assert.equal(state.status.value, 'manual_review')
  }
  finally { scope.stop() }
})

test('账号切换立即丢弃旧认证结果，也拒绝切回同一账号前发出的旧请求', async () => {
  const { context, requests, scope, state } = setup()
  try {
    const initial = state.refresh()
    requests[0].resolve({ status: 'verified' })
    await initial
    const oldRequest = state.refresh()
    context.user = { id: 2, real_name_status: 'unverified' }
    assert.equal(state.status.value, 'unverified')
    context.user = { id: 1, real_name_status: 'manual_review' }
    requests[1].resolve({ status: 'verified' })
    await oldRequest
    assert.equal(state.status.value, 'manual_review')

    context.user = null
    await state.refresh()
    assert.equal(state.status.value, undefined)
    assert.equal(requests.length, 2)
  }
  finally { scope.stop() }
})
