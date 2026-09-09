import { isH5, isMpWeixin } from '@uni-helper/uni-env'
import { h5StorageAdapters } from './h5/storage'
import { h5AuthAdapter } from './h5/auth'
import { h5FilePickerAdapter } from './h5/file-picker'
import { weixinAuthAdapter } from './weixin/auth'
import { weixinFilePickerAdapter } from './weixin/file-picker'
import { weixinStorageAdapters } from './weixin/storage'

function unsupportedPlatform(): never {
  throw new Error('当前构建平台尚未接入平台适配器')
}

export const platform = isH5
  ? { storage: h5StorageAdapters, auth: h5AuthAdapter, filePicker: h5FilePickerAdapter }
  : isMpWeixin
    ? { storage: weixinStorageAdapters, auth: weixinAuthAdapter, filePicker: weixinFilePickerAdapter }
    : unsupportedPlatform()

export const platformStorage = platform.storage
