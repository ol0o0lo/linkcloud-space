import type { PickedFile, PlatformFilePickerAdapter } from '../contracts/file-picker'

function nameFromPath(path: string): string {
  return path.split('/').pop() || 'upload-file'
}

export const h5FilePickerAdapter: PlatformFilePickerAdapter = {
  pick(options) {
    if (options.kind !== 'image')
      return Promise.resolve({ supported: false, reason: 'H5 文件选择器尚未启用通用文件模式' })
    return new Promise((resolve, reject) => {
      uni.chooseImage({
        count: options.count,
        success(result) {
          const paths = Array.isArray(result.tempFilePaths) ? result.tempFilePaths : [result.tempFilePaths]
          resolve({
            supported: true,
            value: paths.map((path, index) => {
              const file = result.tempFiles[index]
              return {
                path,
                name: typeof file === 'object' && file && 'name' in file ? String(file.name) : nameFromPath(path),
                size: typeof file === 'object' && file && 'size' in file ? Number(file.size) : 0,
              } satisfies PickedFile
            }),
          })
        },
        fail: reject,
      })
    })
  },
}
