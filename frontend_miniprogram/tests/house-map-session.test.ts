import assert from 'node:assert/strict'
import test from 'node:test'

import { createHouseMapSession } from '../src/features/houses/house-map-session.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

test('地图会话合并连续视野事件且只请求最后一次', async () => {
  const requests: string[] = []
  const session = createHouseMapSession<{ key: string }, string>({
    debounceMs: 10,
    buildKey: params => params.key,
    request: async (params) => {
      requests.push(params.key)
      return params.key
    },
    onCommit() {},
  })

  session.schedule({ key: 'first' })
  session.schedule({ key: 'second' })
  await new Promise(resolve => setTimeout(resolve, 30))

  assert.deepEqual(requests, ['second'])
  session.dispose()
})

test('显式地图加载会取消尚未执行的视野请求', async () => {
  const requests: string[] = []
  const session = createHouseMapSession<{ key: string }, string>({
    debounceMs: 10,
    buildKey: params => params.key,
    request: async (params) => {
      requests.push(params.key)
      return params.key
    },
    onCommit() {},
  })

  session.schedule({ key: 'nearby-viewport' })
  await session.load({ key: 'full-city' })
  await new Promise(resolve => setTimeout(resolve, 30))

  assert.deepEqual(requests, ['full-city'])
  session.dispose()
})

test('点击标记会取消排队和在途的旧视野请求', async () => {
  const pending = new Map<string, ReturnType<typeof deferred<string>>>()
  const commits: string[] = []
  const session = createHouseMapSession<{ key: string }, string>({
    debounceMs: 10,
    buildKey: params => params.key,
    request: (params) => {
      const task = deferred<string>()
      pending.set(params.key, task)
      return task.promise
    },
    onCommit: result => commits.push(result),
  })

  const oldRequest = session.load({ key: 'old-viewport' })
  session.schedule({ key: 'queued-viewport' })
  session.cancelPending()
  pending.get('old-viewport')!.resolve('old-result')
  await oldRequest
  await new Promise(resolve => setTimeout(resolve, 30))

  assert.deepEqual(Array.from(pending.keys()), ['old-viewport'])
  assert.deepEqual(commits, [])

  const targetRequest = session.load({ key: 'target-viewport' })
  pending.get('target-viewport')!.resolve('target-result')
  await targetRequest
  assert.deepEqual(commits, ['target-result'])
  session.dispose()
})

test('地图会话忽略比当前视野更早返回的过期响应', async () => {
  const pending = new Map<string, ReturnType<typeof deferred<string>>>()
  const commits: string[] = []
  const session = createHouseMapSession<{ key: string }, string>({
    buildKey: params => params.key,
    request: (params) => {
      const task = deferred<string>()
      pending.set(params.key, task)
      return task.promise
    },
    onCommit: result => commits.push(result),
  })

  const first = session.load({ key: 'first' })
  const second = session.load({ key: 'second' })
  pending.get('second')!.resolve('second-result')
  await second
  pending.get('first')!.resolve('first-result')
  await first

  assert.deepEqual(commits, ['second-result'])
  session.dispose()
})

test('地图会话返回已浏览区域时先恢复缓存再静默刷新', async () => {
  const responses = new Map<string, string>([
    ['first', 'first-result'],
    ['second', 'second-result'],
  ])
  const commits: Array<{ result: string, cached: boolean }> = []
  const session = createHouseMapSession<{ key: string }, string>({
    buildKey: params => params.key,
    request: async params => responses.get(params.key)!,
    onCommit: (result, meta) => commits.push({ result, cached: meta.cached }),
  })

  await session.load({ key: 'first' })
  await session.load({ key: 'second' })
  responses.set('first', 'first-refreshed')
  await session.load({ key: 'first' })

  assert.deepEqual(commits, [
    { result: 'first-result', cached: false },
    { result: 'second-result', cached: false },
    { result: 'first-result', cached: true },
    { result: 'first-refreshed', cached: false },
  ])
  session.dispose()
})
