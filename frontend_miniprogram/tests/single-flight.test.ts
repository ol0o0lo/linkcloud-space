import assert from 'node:assert/strict'
import test from 'node:test'

import { createSingleFlight } from '../src/core/lifecycle/single-flight.ts'

test('并发启动事件复用同一个任务且完成后允许再次执行', async () => {
  let executions = 0
  let release: (() => void) | undefined
  const run = createSingleFlight(async () => {
    executions += 1
    await new Promise<void>((resolve) => {
      release = resolve
    })
  })

  const first = run()
  const second = run()
  assert.equal(first, second)
  assert.equal(executions, 1)
  release?.()
  await first

  const third = run()
  assert.notEqual(third, first)
  assert.equal(executions, 2)
  release?.()
  await third
})
