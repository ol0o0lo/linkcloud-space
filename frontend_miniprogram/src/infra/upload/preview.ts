import { resolveApiUrl } from '@/core/config/runtime'
import { getLeaseContractFile } from '@/domain/lease-contract'

export async function openLeaseContract(file: Record<string, unknown>) {
  const { url, extension } = getLeaseContractFile(file)
  if (!url)
    throw new Error('附件链接已失效，请刷新租约后重试')
  let target = resolveApiUrl(url)
  // #ifdef H5
  target = new URL(target, window.location.origin).href
  // #endif
  if (!/^https?:\/\//i.test(target))
    throw new Error('附件链接无效')
  // #ifdef H5
  const link = document.createElement('a')
  link.href = target
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
  return
  // #endif
  // #ifndef H5
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    await uni.previewImage({ urls: [target] })
    return
  }
  if (!['pdf', 'doc', 'docx'].includes(extension))
    throw new Error('当前平台不支持此文件格式')
  const result = await uni.downloadFile({ url: target })
  if (result.statusCode !== 200)
    throw new Error('附件下载失败，请稍后重试')
  await uni.openDocument({ filePath: result.tempFilePath, fileType: extension, showMenu: true })
  // #endif
}
