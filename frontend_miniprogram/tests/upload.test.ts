import assert from 'node:assert/strict'
import test from 'node:test'

import { AppError } from '../src/core/errors/app-error.ts'
import { parseUploadResponse, validateUploadFiles } from '../src/infra/upload/upload-contract.ts'

test('上传前统一校验数量、大小和扩展名', () => {
  assert.deepEqual(validateUploadFiles([
    { path: '/tmp/a.jpg', name: 'a.jpg', size: 1024 },
  ], {
    maxCount: 1,
    maxSizeBytes: 2048,
    extensions: ['jpg', 'png'],
  }), [{ path: '/tmp/a.jpg', name: 'a.jpg', size: 1024 }])

  assert.throws(() => validateUploadFiles([
    { path: '/tmp/a.exe', name: 'a.exe', size: 1024 },
  ], {
    maxCount: 1,
    maxSizeBytes: 2048,
    extensions: ['jpg'],
  }), (error: unknown) => error instanceof AppError && error.kind === 'validation')
})

test('媒体上传响应使用与普通请求一致的成功信封和错误模型', () => {
  const media = [{ id: 1, url: 'https://cdn.example.com/a.jpg' }]
  assert.deepEqual(parseUploadResponse(201, JSON.stringify({ code: 0, data: media })), media)
  assert.throws(
    () => parseUploadResponse(422, JSON.stringify({ detail: '文件类型不支持' })),
    (error: unknown) => error instanceof AppError && error.kind === 'validation' && error.message === '文件类型不支持',
  )
})
