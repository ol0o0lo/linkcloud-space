import type { PlatformFilePickerAdapter } from '../contracts/file-picker'

export const weixinFilePickerAdapter: PlatformFilePickerAdapter = {
  pick(options) {
    if (options.kind !== 'image')
      return Promise.resolve({ supported: false, reason: '微信通用文件请选择能力尚未启用' })
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
