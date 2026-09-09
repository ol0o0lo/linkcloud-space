export type HouseMatchErrorKind = 'expired' | 'not-found' | 'unsupported' | 'load-failed'

function readStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object')
    return undefined

  const source = error as Record<string, unknown>
  if (typeof source.statusCode === 'number')
    return source.statusCode

  const response = source.response
  if (response && typeof response === 'object' && typeof (response as Record<string, unknown>).status === 'number')
    return (response as Record<string, number>).status

  return undefined
}

export function resolveHouseMatchError(error: unknown): HouseMatchErrorKind {
  switch (readStatusCode(error)) {
    case 404:
      return 'not-found'
    case 410:
      return 'expired'
    case 422:
      return 'unsupported'
    default:
      return 'load-failed'
  }
}

export function getHouseMatchErrorCopy(kind: HouseMatchErrorKind) {
  switch (kind) {
    case 'expired':
      return {
        title: '配房链接已失效',
        tip: '链接可能已过期或被顾问主动关闭，请联系顾问重新获取。',
      }
    case 'not-found':
      return {
        title: '未找到配房内容',
        tip: '请检查链接是否完整，或联系顾问重新发送。',
      }
    case 'unsupported':
      return {
        title: '配房链接需要更新',
        tip: '该链接版本已不再支持，请联系顾问重新生成。',
      }
    default:
      return {
        title: '配房内容加载失败',
        tip: '请检查网络后重试。',
      }
  }
}
