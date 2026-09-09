export function getHttpErrorMessage(response: unknown, fallback = '请求错误'): string {
  if (!response || typeof response !== 'object')
    return fallback

  const data = response as Record<string, unknown>
  for (const key of ['msg', 'message', 'detail']) {
    const value = data[key]
    if (typeof value === 'string' && value.trim())
      return value
  }

  return fallback
}
