import type { PlatformCapabilityResult } from './capability'

export interface PickedFile {
  path: string
  name: string
  size: number
}

export interface FilePickerOptions {
  kind: 'image' | 'file'
  count: number
}

export interface PlatformFilePickerAdapter {
  pick: (options: FilePickerOptions) => Promise<PlatformCapabilityResult<PickedFile[]>>
}
