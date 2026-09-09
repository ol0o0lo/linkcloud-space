import assert from 'node:assert/strict'
import test from 'node:test'

import { getHttpErrorMessage } from '../src/domain/http-error.ts'

test('通用请求错误兼容后端 msg、message 和 detail', () => {
  assert.equal(getHttpErrorMessage({ msg: '旧接口错误' }), '旧接口错误')
  assert.equal(getHttpErrorMessage({ message: '操作不允许' }), '操作不允许')
  assert.equal(getHttpErrorMessage({ detail: '参数不正确' }), '参数不正确')
  assert.equal(getHttpErrorMessage({}), '请求错误')
})
