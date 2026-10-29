import type { PlatformCapabilityResult } from './capability'

export interface PickedFile {
  path: string
  name: string
  size: number
  file?: File
}

export interface FilePickerOptions {
  kind: 'image' | 'file'
  count: number
  extensions?: string[]
}

export interface PlatformFilePickerAdapter {
  pick: (options: FilePickerOptions) => Promise<PlatformCapabilityResult<PickedFile[]>>
}
