import assert from 'node:assert/strict'
import test from 'node:test'

import { AppError, normalizeAppError } from '../src/core/errors/app-error.ts'

test('请求错误统一映射为稳定的错误种类并保留后端业务码', () => {
  const error = normalizeAppError({
    statusCode: 409,
    data: { code: 'HOUSE_LOCKED', message: '房源正在处理中' },
  })

  assert.ok(error instanceof AppError)
  assert.equal(error.kind, 'conflict')
  assert.equal(error.statusCode, 409)
  assert.equal(error.businessCode, 'HOUSE_LOCKED')
  assert.equal(error.message, '房源正在处理中')
  assert.equal(error.retryable, false)
})

test('Django Ninja 校验详情归一化为字段错误', () => {
  const error = normalizeAppError({
    statusCode: 422,
    data: {
      detail: [
        { loc: ['body', 'email'], msg: '请输入有效邮箱' },
        { loc: ['body', 'password'], msg: '密码长度不足' },
      ],
    },
  })

  assert.equal(error.kind, 'validation')
  assert.equal(error.message, '请输入有效邮箱')
  assert.deepEqual(error.fieldErrors, {
    email: ['请输入有效邮箱'],
    password: ['密码长度不足'],
  })
})

test('无响应的传输失败可区分网络、超时和取消', () => {
  assert.equal(normalizeAppError({ cause: new Error('offline') }).kind, 'network')
  assert.equal(normalizeAppError({ timedOut: true }).kind, 'timeout')
  assert.equal(normalizeAppError({ cancelled: true }).kind, 'cancelled')
  assert.equal(normalizeAppError({ cause: new Error('offline') }).retryable, true)
})
