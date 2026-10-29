import type { PlatformFilePickerAdapter } from '../contracts/file-picker'

export const weixinFilePickerAdapter: PlatformFilePickerAdapter = {
  pick(options) {
    if (options.kind === 'file') {
      return new Promise((resolve, reject) => {
        wx.chooseMessageFile({
          count: options.count,
          type: 'file',
          extension: (options.extensions || ['pdf', 'doc', 'docx']).map(extension => extension.replace(/^\./, '')),
          success: result => resolve({ supported: true, value: result.tempFiles.map(file => ({ path: file.path, name: file.name, size: file.size })) }),
          fail: error => error.errMsg.includes('cancel') ? resolve({ supported: true, value: [] }) : reject(error),
        })
      })
    }
    return new Promise((resolve, reject) => {
      uni.chooseMedia({
        count: options.count,
        mediaType: ['image'],
        success(result) {
          resolve({
            supported: true,
            value: result.tempFiles.map(file => ({
              path: file.tempFilePath,
              name: file.tempFilePath.split('/').pop() || 'upload-image',
              size: file.size,
            })),
          })
        },
        fail: reject,
      })
    })
  },
}
