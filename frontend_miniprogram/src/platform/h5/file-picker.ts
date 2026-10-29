import type { PickedFile, PlatformFilePickerAdapter } from '../contracts/file-picker'

function nameFromPath(path: string): string {
  return path.split('/').pop() || 'upload-file'
}

export const h5FilePickerAdapter: PlatformFilePickerAdapter = {
  pick(options) {
    if (options.kind === 'file') {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = (options.extensions || ['pdf', 'doc', 'docx']).map(extension => `.${extension.replace(/^\./, '')}`).join(',')
        input.multiple = options.count > 1
        let settled = false
        const finish = () => {
          if (settled)
            return
          settled = true
          resolve({ supported: true, value: Array.from(input.files || []).map(file => ({ path: '', name: file.name, size: file.size, file })) })
          input.remove()
          window.removeEventListener('focus', onFocus)
        }
        function onFocus() {
          setTimeout(finish, 500)
        }
        input.addEventListener('change', finish, { once: true })
        input.addEventListener('cancel', finish, { once: true })
        window.addEventListener('focus', onFocus, { once: true })
        input.style.display = 'none'
        document.body.appendChild(input)
        input.click()
      })
    }
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
