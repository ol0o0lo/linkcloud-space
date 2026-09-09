import assert from 'node:assert/strict'
import test from 'node:test'

import { useAsyncTask } from '../src/shared/composables/useAsyncTask.ts'
import { usePagedQuery } from '../src/shared/composables/usePagedQuery.ts'

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('异步任务只接收最后一次执行结果', async () => {
  const first = deferred<string>()
  const second = deferred<string>()
  const task = useAsyncTask((key: string) => key === 'first' ? first.promise : second.promise)

  const firstRun = task.run('first')
  const secondRun = task.run('second')
  second.resolve('second-result')
  await secondRun
  first.resolve('stale-result')
  await firstRun

  assert.equal(task.data.value, 'second-result')
  assert.equal(task.loading.value, false)
  assert.equal(task.error.value, null)
})

test('分页查询统一处理刷新、追加和到底状态', async () => {
  const calls: number[] = []
  const query = usePagedQuery<number>(async ({ page, pageSize }) => {
    calls.push(page)
    const items = page === 1 ? [1, 2] : [3]
    return { items, total: 3, page, page_size: pageSize }
  }, { pageSize: 2 })

  await query.refresh()
  await query.loadMore()
  await query.loadMore()

  assert.deepEqual(query.items.value, [1, 2, 3])
  assert.deepEqual(calls, [1, 2])
  assert.equal(query.finished.value, true)
})
