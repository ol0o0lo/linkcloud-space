import assert from 'node:assert/strict'
import test from 'node:test'
import { getLeaseContractFile } from '../src/domain/lease-contract.ts'
import { h5FilePickerAdapter } from '../src/platform/h5/file-picker.ts'
import { weixinFilePickerAdapter } from '../src/platform/weixin/file-picker.ts'
import { validateUploadFiles } from '../src/infra/upload/upload-contract.ts'

test('合同文件显示原始名称并识别格式，缺失链接不伪造地址', () => {
  assert.deepEqual(getLeaseContractFile({ original_filename: '租赁合同.PDF', url: 'https://example.com/contract.pdf' }), {
    name: '租赁合同.PDF',
    extension: 'pdf',
    url: 'https://example.com/contract.pdf',
  })
  assert.equal(getLeaseContractFile({ media_id: 7 }).url, '')
})

test('H5 文件选择保留真实 File 和原始扩展名，取消返回空集合', async () => {
  const file = new File(['contract'], '租赁合同.pdf', { type: 'application/pdf' })
  let cancelled = false
  const listeners = new Map<string, () => void>()
  const input = {
    type: '',
    accept: '',
    multiple: false,
    style: { display: '' },
    files: [file],
    addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
    remove: () => {},
    click: () => {
      input.files = cancelled ? [] : [file]
      listeners.get(cancelled ? 'cancel' : 'change')?.()
    },
  }
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => input, body: { appendChild: () => {} } } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener: () => {}, removeEventListener: () => {} } })
  try {
    const result = await h5FilePickerAdapter.pick({ kind: 'file', count: 1 })
    assert.equal(result.supported, true)
    if ('value' in result) {
      assert.equal(result.value[0].file, file)
      assert.equal(result.value[0].name, '租赁合同.pdf')
      assert.doesNotThrow(() => validateUploadFiles(result.value, { maxCount: 1, maxSizeBytes: 1024, extensions: ['pdf'] }))
    }
    cancelled = true
    assert.deepEqual(await h5FilePickerAdapter.pick({ kind: 'file', count: 1 }), { supported: true, value: [] })
  }
  finally {
    for (const [name, original] of [['document', originalDocument], ['window', originalWindow]] as const) {
      if (original)
        Object.defineProperty(globalThis, name, original)
      else
        Reflect.deleteProperty(globalThis, name)
    }
  }
})

test('微信文件选择保留文件路径与原名，用户取消不报上传错误', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'wx')
  let cancelled = false
  Object.defineProperty(globalThis, 'wx', { configurable: true, value: {
    chooseMessageFile: (options: { success: (result: unknown) => void, fail: (result: unknown) => void }) => {
      if (cancelled)
        options.fail({ errMsg: 'chooseMessageFile:fail cancel' })
      else
        options.success({ tempFiles: [{ path: '/tmp/contract.docx', name: '合同.docx', size: 100 }] })
    },
  } })
  try {
    assert.deepEqual(await weixinFilePickerAdapter.pick({ kind: 'file', count: 1 }), { supported: true, value: [{ path: '/tmp/contract.docx', name: '合同.docx', size: 100 }] })
    cancelled = true
    assert.deepEqual(await weixinFilePickerAdapter.pick({ kind: 'file', count: 1 }), { supported: true, value: [] })
  }
  finally {
    if (previous)
      Object.defineProperty(globalThis, 'wx', previous)
    else
      Reflect.deleteProperty(globalThis, 'wx')
  }
})
